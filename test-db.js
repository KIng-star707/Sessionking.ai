import https from 'https';

https.get('https://firestore.googleapis.com/v1/projects/king-fx-b17b7/databases/ai-studio-c5a2bd9c-cc6d-4007-872d-13a4cbfe7054/documents/test/connection?key=AIzaSyD2bURFV9nciEbf4T0d20PavoQp1eL3z7Y', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
}).on('error', (err) => console.error(err));
