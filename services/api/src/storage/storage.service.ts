import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "fs";
import * as path from "path";

/**
 * Local-disk storage for MVP dev use, gated behind STORAGE_PROVIDER=local
 * (the only mode implemented - see docs/third-party-setup.md, Cloudinary
 * isn't provisioned). Files live under a directory that's gitignored and
 * never served by a static file middleware - the only way to read one back
 * is through an authenticated route that checks ownership first
 * (TutorsController's document-download route).
 */
@Injectable()
export class StorageService {
  private readonly root: string;

  constructor(private readonly config: ConfigService) {
    this.root =
      this.config.get<string>("LOCAL_STORAGE_DIR") ??
      path.join(process.cwd(), ".devdata", "uploads");
  }

  async save(relativeDir: string, filename: string, buffer: Buffer): Promise<string> {
    const dir = path.join(this.root, relativeDir);
    await fs.mkdir(dir, { recursive: true });
    const relativePath = path.join(relativeDir, filename);
    await fs.writeFile(path.join(this.root, relativePath), buffer);
    return relativePath;
  }

  async read(relativePath: string): Promise<Buffer> {
    return fs.readFile(path.join(this.root, relativePath));
  }
}
