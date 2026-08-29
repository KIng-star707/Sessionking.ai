import firebaseConfig from "../../firebase-applet-config.json";

export function getFirebaseConfig() {
  return firebaseConfig;
}

// Transform REST document fields format to simple JS object
export function parseRestFields(fields: any): any {
  const obj: any = {};
  if (!fields) return obj;
  for (const key of Object.keys(fields)) {
    const valObj = fields[key];
    const type = Object.keys(valObj)[0];
    const val = valObj[type];
    if (type === 'mapValue') {
      obj[key] = parseRestFields(val.fields || {});
    } else if (type === 'arrayValue') {
      obj[key] = (val.values || []).map((v: any) => {
        const subType = Object.keys(v)[0];
        return subType === 'mapValue' ? parseRestFields(v[subType].fields || {}) : v[subType];
      });
    } else if (type === 'integerValue') {
      obj[key] = parseInt(val, 10);
    } else if (type === 'doubleValue') {
      obj[key] = parseFloat(val);
    } else if (type === 'booleanValue') {
      obj[key] = val;
    } else {
      obj[key] = val;
    }
  }
  return obj;
}

// Convert regular JS objects back to Firestore REST fields
export function toRestFields(obj: any): any {
  const fields: any = {};
  if (!obj) return fields;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val === null || val === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        fields[key] = { integerValue: String(val) };
      } else {
        fields[key] = { doubleValue: val };
      }
    } else if (typeof val === 'string') {
      fields[key] = { stringValue: val };
    } else if (Array.isArray(val)) {
      fields[key] = {
        arrayValue: {
          values: val.map(item => {
            if (item === null || item === undefined) return { nullValue: null };
            if (typeof item === 'object') return { mapValue: { fields: toRestFields(item) } };
            if (typeof item === 'string') return { stringValue: item };
            if (typeof item === 'boolean') return { booleanValue: item };
            if (typeof item === 'number') {
              if (Number.isInteger(item)) return { integerValue: String(item) };
              return { doubleValue: item };
            }
            return { stringValue: String(item) };
          })
        }
      };
    } else if (typeof val === 'object') {
      fields[key] = { mapValue: { fields: toRestFields(val) } };
    }
  }
  return fields;
}

// System user authentication credentials (cached token)
let cachedSystemToken: string | null = null;
let cachedSystemRefreshToken: string | null = null;
let systemTokenExpiry: number = 0;

export async function getSystemIdToken(): Promise<string> {
  if (!firebaseConfig) {
    throw new Error("Firebase config not available");
  }

  const now = Date.now();
  if (cachedSystemToken && systemTokenExpiry > now + 60000) {
    return cachedSystemToken;
  }
  
  if (cachedSystemRefreshToken) {
    try {
      const url = `https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: cachedSystemRefreshToken
        })
      });
      if (res.ok) {
        const data: any = await res.json();
        cachedSystemToken = data.id_token;
        cachedSystemRefreshToken = data.refresh_token;
        systemTokenExpiry = Date.now() + (parseInt(data.expires_in, 10) * 1000);
        return cachedSystemToken!;
      }
    } catch (e) {
      console.warn("Failed to refresh system token, attempting re-signin:", e);
    }
  }

  // Attempt Sign-in
  const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`;
  const credentials = {
    email: process.env.FIREBASE_SYSTEM_EMAIL || "system-backend@sessionking.com",
    password: process.env.FIREBASE_SYSTEM_PASSWORD || "SystemBackendPassword123!",
    returnSecureToken: true
  };
  
  let res = await fetch(signInUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  
  if (res.status === 400) {
    let errorJson: any = {};
    try {
      errorJson = await res.clone().json();
    } catch(e) {}
    if (errorJson?.error?.message === "EMAIL_NOT_FOUND" || errorJson?.error?.message === "INVALID_LOGIN_ATTEMPT" || errorJson?.error?.message === "INVALID_LOGIN_CREDENTIALS") {
      console.warn("System backend account not found or invalid credentials. Trying to create or fallback...", errorJson?.error?.message);
      const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`;
      try {
        const signUpRes = await fetch(signUpUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials)
        });
        if (signUpRes.ok) {
           res = signUpRes;
        } else {
           console.warn("SignUp also failed, falling back gracefully");
        }
      } catch (e) {
        console.error("SignUp request failed", e);
      }
    }
  }
  
  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed system authentication: ${res.status} ${text}. Returning fallback empty token.`);
    return ""; // Fallback
  }
  
  const data: any = await res.json();
  cachedSystemToken = data.idToken;
  cachedSystemRefreshToken = data.refreshToken;
  systemTokenExpiry = Date.now() + (parseInt(data.expiresIn, 10) * 1000);
  return cachedSystemToken!;
}

export async function getFirestoreDocRest(collectionName: string, docId: string, idToken?: string): Promise<any> {
  if (!firebaseConfig) throw new Error("Firebase config not available");
  
  const token = idToken || await getSystemIdToken();
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId || '(default)'}/documents/${collectionName}/${docId}?key=${firebaseConfig.apiKey}`;
  const headers: Record<string, string> = {
    'Referer': 'https://ais-dev-nsls2jaieo6hv3iqjtwdoi-428555961559.europe-west2.run.app/',
    'Authorization': `Bearer ${token}`
  };
  const res = await fetch(url, { headers });
  if (res.status === 404) {
    return { exists: false, id: docId, data: () => undefined };
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore REST error: ${res.status} ${text}`);
  }
  const json = await res.json();
  const data = parseRestFields(json.fields || {});
  return {
    exists: true,
    id: docId,
    data: () => data
  };
}

export async function createFirestoreDocRest(collectionName: string, docId: string, data: any, idToken?: string): Promise<any> {
  if (!firebaseConfig) throw new Error("Firebase config not available");
  
  const token = idToken || await getSystemIdToken();
  const fields = toRestFields(data);
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId || '(default)'}/documents/${collectionName}/${docId}?key=${firebaseConfig.apiKey}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Referer': 'https://ais-dev-nsls2jaieo6hv3iqjtwdoi-428555961559.europe-west2.run.app/',
    'Authorization': `Bearer ${token}`
  };
  const res = await fetch(url, {
    method: 'PATCH', // PATCH with no exists expectation creates or overwrites
    headers,
    body: JSON.stringify({ fields })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore REST create error: ${res.status} ${text}`);
  }
  const json = await res.json();
  return {
    id: docId,
    data: () => parseRestFields(json.fields || {})
  };
}

export async function updateFirestoreDocRest(collectionName: string, docId: string, data: any, idToken?: string): Promise<any> {
  if (!firebaseConfig) throw new Error("Firebase config not available");
  
  const token = idToken || await getSystemIdToken();
  const fields = toRestFields(data);
  const updateMaskParams = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId || '(default)'}/documents/${collectionName}/${docId}?key=${firebaseConfig.apiKey}&currentDocument.exists=true&${updateMaskParams}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Referer': 'https://ais-dev-nsls2jaieo6hv3iqjtwdoi-428555961559.europe-west2.run.app/',
    'Authorization': `Bearer ${token}`
  };
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore REST update error: ${res.status} ${text}`);
  }
  const json = await res.json();
  return {
    id: docId,
    data: () => parseRestFields(json.fields || {})
  };
}

export async function deleteFirestoreDocRest(collectionName: string, docId: string, idToken?: string): Promise<void> {
  if (!firebaseConfig) throw new Error("Firebase config not available");
  
  const token = idToken || await getSystemIdToken();
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId || '(default)'}/documents/${collectionName}/${docId}?key=${firebaseConfig.apiKey}`;
  
  const headers: Record<string, string> = {
    'Referer': 'https://ais-dev-nsls2jaieo6hv3iqjtwdoi-428555961559.europe-west2.run.app/',
    'Authorization': `Bearer ${token}`
  };
  const res = await fetch(url, {
    method: 'DELETE',
    headers
  });
  if (res.status !== 200 && res.status !== 204 && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Firestore REST delete error: ${res.status} ${text}`);
  }
}

export async function listFirestoreDocsRest(collectionName: string, idToken?: string, limit?: number): Promise<any[]> {
  if (!firebaseConfig) throw new Error("Firebase config not available");
  
  const token = idToken || await getSystemIdToken();
  let url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId || '(default)'}/documents/${collectionName}?key=${firebaseConfig.apiKey}`;
  if (limit) {
    url += `&pageSize=${limit}`;
  }
  const headers: Record<string, string> = {
    'Referer': 'https://ais-dev-nsls2jaieo6hv3iqjtwdoi-428555961559.europe-west2.run.app/',
    'Authorization': `Bearer ${token}`
  };
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore REST list error: ${res.status} ${text}`);
  }
  const json = await res.json();
  const docs = json.documents || [];
  return docs.map((doc: any) => {
    const pathParts = doc.name.split('/');
    const id = pathParts[pathParts.length - 1];
    const data = parseRestFields(doc.fields || {});
    return {
      id,
      data: () => data,
      ref: { id }
    };
  });
}

export async function queryFirestoreDocsRest(query: any, idToken?: string): Promise<any[]> {
  if (!firebaseConfig) throw new Error("Firebase config not available");
  
  const token = idToken || await getSystemIdToken();
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId || '(default)'}/documents:runQuery?key=${firebaseConfig.apiKey}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Referer': 'https://ais-dev-nsls2jaieo6hv3iqjtwdoi-428555961559.europe-west2.run.app/',
    'Authorization': `Bearer ${token}`
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(query)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore REST query error: ${res.status} ${text}`);
  }
  const json = await res.json();
  const results = Array.isArray(json) ? json : [json];
  const docs: any[] = [];
  for (const item of results) {
    if (item.document) {
      const doc = item.document;
      const pathParts = doc.name.split('/');
      const id = pathParts[pathParts.length - 1];
      const data = parseRestFields(doc.fields || {});
      docs.push({
        id,
        data: () => data,
        ref: { id }
      });
    }
  }
  return docs;
}
