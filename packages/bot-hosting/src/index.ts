import express from 'express';

export function createExpressApp() {
  const app = express();
  // Add your express app configuration here
  return app;
}

export function startExpressServer(app: express.Application, port: number) {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
