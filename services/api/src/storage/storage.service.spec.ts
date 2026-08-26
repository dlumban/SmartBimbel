import { ConfigService } from "@nestjs/config";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { StorageService } from "./storage.service";

describe("StorageService", () => {
  let tmpDir: string;
  let service: StorageService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "smartbimbel-storage-"));
    const config = { get: () => tmpDir } as unknown as ConfigService;
    service = new StorageService(config);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("saves a file and returns its relative path", async () => {
    const relativePath = await service.save(
      "tutor-documents/u1",
      "ktp.jpg",
      Buffer.from("fake-image-bytes"),
    );

    expect(relativePath).toBe(path.join("tutor-documents/u1", "ktp.jpg"));
    const written = await fs.readFile(path.join(tmpDir, relativePath));
    expect(written.toString()).toBe("fake-image-bytes");
  });

  it("reads back a previously saved file", async () => {
    const relativePath = await service.save(
      "tutor-documents/u1",
      "diploma.pdf",
      Buffer.from("pdf-bytes"),
    );

    const contents = await service.read(relativePath);
    expect(contents.toString()).toBe("pdf-bytes");
  });
});
