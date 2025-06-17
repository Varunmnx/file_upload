const REGEX = /(^\/)|(\/$)/g;
class BasePath {
  constructor(protected root: string) {
    this.root = this.root.replace(REGEX, "");
  }

  getPath(...sublinks: (string | { param: string })[]): string {
    const sanitizedSublinks = sublinks.map((sublink) =>
      typeof sublink === "string"
        ? sublink.replace(REGEX, "")
        : `:${sublink.param}`,
    );
    const fullPath = [this.root, ...sanitizedSublinks].join("/");
    return fullPath.startsWith("/") ? fullPath : `/${fullPath}`;
  }

  belongsToPath(path: string): boolean {
    const sanitizedPath = path.replace(REGEX, "");
    return (
      sanitizedPath === this.root || sanitizedPath.startsWith(`${this.root}/`)
    );
  }
}

class PublicPath extends BasePath {
  constructor() {
    super("");
  }

  signin = this.getPath("signin");
  signup = this.getPath("signup");
}

class ProtectedPath extends BasePath {
  constructor() {
    super("dashboard");
  }
  dashboard = this.getPath("home");
}

export const PATH_PUBLIC = new PublicPath();
export const PATH_AUTH = new ProtectedPath();
