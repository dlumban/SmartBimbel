import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import * as Sentry from "@sentry/node";
import { SentryExceptionFilter } from "./sentry-exception.filter";

jest.mock("@sentry/node", () => ({ captureException: jest.fn() }));

describe("SentryExceptionFilter", () => {
  const originalDsn = process.env.SENTRY_DSN;
  let filter: SentryExceptionFilter;
  let host: { switchToHttp: jest.Mock };
  const baseCatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    const httpAdapter = {} as never;
    filter = new SentryExceptionFilter(httpAdapter);
    // BaseExceptionFilter.catch does real Express response work we don't
    // want to exercise here - only this filter's own decision of whether
    // to report to Sentry is under test.
    jest.spyOn(
      Object.getPrototypeOf(Object.getPrototypeOf(filter)),
      "catch",
    ).mockImplementation(baseCatch);
    host = { switchToHttp: jest.fn() };
  });

  afterEach(() => {
    process.env.SENTRY_DSN = originalDsn;
  });

  it("does not report to Sentry when SENTRY_DSN is unset", () => {
    delete process.env.SENTRY_DSN;
    filter.catch(new InternalServerErrorException(), host as never);
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(baseCatch).toHaveBeenCalled();
  });

  it("reports a 5xx HttpException to Sentry when configured", () => {
    process.env.SENTRY_DSN = "https://fake@sentry.example/1";
    const exception = new InternalServerErrorException();
    filter.catch(exception, host as never);
    expect(Sentry.captureException).toHaveBeenCalledWith(exception);
  });

  it("does not report a 4xx HttpException to Sentry (expected traffic, not an incident)", () => {
    process.env.SENTRY_DSN = "https://fake@sentry.example/1";
    filter.catch(new BadRequestException(), host as never);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("reports a non-HttpException (unexpected crash) to Sentry when configured", () => {
    process.env.SENTRY_DSN = "https://fake@sentry.example/1";
    const exception = new Error("unexpected");
    filter.catch(exception, host as never);
    expect(Sentry.captureException).toHaveBeenCalledWith(exception);
  });
});
