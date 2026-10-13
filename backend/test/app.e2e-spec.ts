import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (scaffold)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health responds 200', () => {
    return supertest(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', phase: 'scaffold' });
  });
});