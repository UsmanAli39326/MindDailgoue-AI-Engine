const http = require('http');

http.get('http://localhost:8000/therapist/initial-message?id=compassionate-listener', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('RESPONSE:', data);
        process.exit(0);
    });
}).on('error', (err) => {
    console.error('ERROR:', err.message);
    process.exit(1);
});
