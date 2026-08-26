import "reflect-metadata";
import { NestFactory, HttpAdapterHost } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { initSentry } from "./monitoring/sentry";
import { SentryExceptionFilter } from "./monitoring/sentry-exception.filter";

async function bootstrap() {
  initSentry();

  // rawBody: true populates req.rawBody (alongside the normal parsed JSON
  // body) for every route - needed to verify the Stream Chat webhook's
  // HMAC signature (Task 4.1), which must be computed over the exact raw
  // bytes Stream sent, not a re-serialization of the parsed JSON.
  const app = await NestFactory.create(AppModule, { cors: true, rawBody: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new SentryExceptionFilter(app.get(HttpAdapterHost).httpAdapter));

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`SmartBimbel API listening on http://localhost:${port}/api`);
}

bootstrap();
