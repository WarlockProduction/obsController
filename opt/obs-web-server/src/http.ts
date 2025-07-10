import http from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';

const server = http.createServer((req, res) => {
  if ((req.url === '/' || req.url?.startsWith('/?')) && req.method === 'GET') {
    const filePath = path.join(__dirname, '../', 'index.html');

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Erreur serveur');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else if (req.url === '/qr.png' && req.method === 'GET') {
    const filePath = path.join(__dirname, '../', 'qr.png');

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Erreur serveur');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'img/png' });
      res.end(data);
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Page non trouvee');
  }
});

const wss = new WebSocketServer({ server });

const PORT = 5566;
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Serveur HTTP & WS en écoute sur http://localhost:${PORT}`);
});

export default wss;
