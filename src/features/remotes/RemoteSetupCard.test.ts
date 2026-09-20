import { describe, expect, it } from "vitest";
import { remoteUrlError } from "./RemoteSetupCard";

describe("remoteUrlError", () => {
  it("requires a value and rejects option-like or multiline input", () => {
    expect(remoteUrlError(" ")).toBeTruthy();
    expect(remoteUrlError("--upload-pack=bad")).toBeTruthy();
    expect(remoteUrlError("https://example.com/repo.git\nnext")).toBeTruthy();
  });

  it("accepts HTTPS, SSH aliases, and local remotes", () => {
    expect(remoteUrlError("https://github.com/example/repo.git")).toBeNull();
    expect(remoteUrlError("git@github-work:example/repo.git")).toBeNull();
    expect(remoteUrlError("C:/repos/remote.git")).toBeNull();
  });
});
