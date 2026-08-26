import path from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import morgan from 'morgan';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFound';
import { authorsRouter } from './routes/authors';
import { authRouter } from './routes/auth';
import { booksRouter } from './routes/books';
import { categoriesRouter } from './routes/categories';
import { healthRouter } from './routes/health';

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
  app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

  app.use('/api', healthRouter);
  app.use('/api', authRouter);
  app.use('/api', authorsRouter);
  app.use('/api', categoriesRouter);
  app.use('/api', booksRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
