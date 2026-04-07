import express from 'express';

export function keepAlive() {
  const app = express();

  app.get('/', (_req, res) => {
    res.send('Bot is alive');
  });

  app.listen(3000, () => {
    console.log('Keep-alive server running on port 3000');
  });
}
