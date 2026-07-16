import express from 'express';
import http from 'http';
import cors from 'cors';
import { initSocket } from './socket.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Realtime backend running 🚀');
});

const server = http.createServer(app);

initSocket(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Realtime server on port ${PORT}`);
});
