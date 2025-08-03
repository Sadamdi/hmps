#!/usr/bin/env tsx

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

interface PerformanceIssue {
  file: string;
  line?: number;
  issue: string;
  severity: "low" | "medium" | "high";
  suggestion: string;
}

class PerformanceAuditor {
  private issues: PerformanceIssue[] = [];

  async auditProject() {
    console.log("🔍 Starting performance audit...\n");

    await this.auditReactComponents();
    await this.auditBundleSize();
    await this.auditImages();
    await this.auditCSS();

    this.generateReport();
  }

  private async auditReactComponents() {
    console.log("📦 Auditing React components...");

    const componentsDir = path.join(rootDir, "client/src/components");
    const pagesDir = path.join(rootDir, "client/src/pages");

    await this.scanDirectory(componentsDir);
    await this.scanDirectory(pagesDir);
  }

  private async scanDirectory(dir: string) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
      const filePath = path.join(dir, file.name);

      if (file.isDirectory()) {
        await this.scanDirectory(filePath);
      } else if (file.name.endsWith(".tsx") || file.name.endsWith(".ts")) {
        await this.auditFile(filePath);
      }
    }
  }

  private async auditFile(filePath: string) {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const relativePath = path.relative(rootDir, filePath);

    // Check for performance anti-patterns
    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      // Check for missing React.memo
      if (
        line.includes("export default function") &&
        !content.includes("memo(")
      ) {
        this.issues.push({
          file: relativePath,
          line: lineNumber,
          issue: "Component not memoized",
          severity: "medium",
          suggestion:
            "Consider wrapping with React.memo() to prevent unnecessary re-renders",
        });
      }

      // Check for inline object/array creation in JSX
      if (line.includes("style={{") || line.includes("className={`")) {
        this.issues.push({
          file: relativePath,
          line: lineNumber,
          issue: "Inline object creation in render",
          severity: "medium",
          suggestion: "Move object creation outside render or use useMemo",
        });
      }

      // Check for missing key props in lists
      if (line.includes(".map(") && !line.includes("key=")) {
        this.issues.push({
          file: relativePath,
          line: lineNumber,
          issue: "Missing key prop in list rendering",
          severity: "high",
          suggestion: "Add unique key prop to list items",
        });
      }

      // Check for heavy operations in render
      if (line.includes("JSON.parse") || line.includes("JSON.stringify")) {
        this.issues.push({
          file: relativePath,
          line: lineNumber,
          issue: "Heavy operation in render",
          severity: "high",
          suggestion: "Move JSON operations to useMemo or useCallback",
        });
      }
    });
  }

  private async auditBundleSize() {
    console.log("📊 Auditing bundle size...");

    const packageJsonPath = path.join(rootDir, "package.json");
    if (!fs.existsSync(packageJsonPath)) return;

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Check for heavy dependencies
    const heavyDeps = [
      "moment",
      "lodash",
      "jquery",
      "bootstrap",
      "material-ui",
    ];

    heavyDeps.forEach((dep) => {
      if (dependencies[dep]) {
        this.issues.push({
          file: "package.json",
          issue: `Heavy dependency: ${dep}`,
          severity: "medium",
          suggestion: `Consider lighter alternatives (e.g., date-fns instead of moment)`,
        });
      }
    });
  }

  private async auditImages() {
    console.log("🖼️  Auditing images...");

    const publicDir = path.join(rootDir, "public");
    const attachedAssetsDir = path.join(rootDir, "attached_assets");

    await this.scanImagesInDirectory(publicDir);
    await this.scanImagesInDirectory(attachedAssetsDir);
  }

  private async scanImagesInDirectory(dir: string) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
      const filePath = path.join(dir, file.name);

      if (file.isDirectory()) {
        await this.scanImagesInDirectory(filePath);
      } else if (/\.(jpg|jpeg|png|gif|bmp)$/i.test(file.name)) {
        const stats = fs.statSync(filePath);
        const sizeInMB = stats.size / (1024 * 1024);

        if (sizeInMB > 1) {
          this.issues.push({
            file: path.relative(rootDir, filePath),
            issue: `Large image file (${sizeInMB.toFixed(2)}MB)`,
            severity: "high",
            suggestion: "Optimize image size and consider WebP format",
          });
        }
      }
    }
  }

  private async auditCSS() {
    console.log("🎨 Auditing CSS...");

    const cssPath = path.join(rootDir, "client/src/index.css");
    if (!fs.existsSync(cssPath)) return;

    const content = fs.readFileSync(cssPath, "utf-8");

    // Check for unused CSS (basic check)
    if (content.length > 50000) {
      this.issues.push({
        file: "client/src/index.css",
        issue: "Large CSS file",
        severity: "medium",
        suggestion: "Consider splitting CSS or removing unused styles",
      });
    }
  }

  private generateReport() {
    console.log("\n📋 Performance Audit Report");
    console.log("=".repeat(50));

    const highIssues = this.issues.filter((i) => i.severity === "high");
    const mediumIssues = this.issues.filter((i) => i.severity === "medium");
    const lowIssues = this.issues.filter((i) => i.severity === "low");

    console.log(`\n🔴 High Priority Issues: ${highIssues.length}`);
    highIssues.forEach((issue) => {
      console.log(`  📁 ${issue.file}${issue.line ? `:${issue.line}` : ""}`);
      console.log(`     ❌ ${issue.issue}`);
      console.log(`     💡 ${issue.suggestion}\n`);
    });

    console.log(`\n🟡 Medium Priority Issues: ${mediumIssues.length}`);
    mediumIssues.slice(0, 5).forEach((issue) => {
      console.log(`  📁 ${issue.file}${issue.line ? `:${issue.line}` : ""}`);
      console.log(`     ⚠️  ${issue.issue}`);
      console.log(`     💡 ${issue.suggestion}\n`);
    });

    if (mediumIssues.length > 5) {
      console.log(
        `     ... and ${mediumIssues.length - 5} more medium priority issues\n`
      );
    }

    console.log(`\n🟢 Low Priority Issues: ${lowIssues.length}`);

    // Summary
    console.log("\n📊 Summary");
    console.log("-".repeat(30));
    console.log(`Total issues found: ${this.issues.length}`);
    console.log(`High priority: ${highIssues.length}`);
    console.log(`Medium priority: ${mediumIssues.length}`);
    console.log(`Low priority: ${lowIssues.length}`);

    // Recommendations
    console.log("\n🚀 Quick Wins");
    console.log("-".repeat(30));
    console.log("1. Run `npm run optimize:images` to optimize images");
    console.log("2. Add React.memo to frequently re-rendering components");
    console.log("3. Use useMemo/useCallback for expensive operations");
    console.log("4. Implement lazy loading for non-critical components");
    console.log("5. Consider code splitting for large pages");

    if (this.issues.length === 0) {
      console.log("\n🎉 Great! No major performance issues found!");
    }
  }
}

// Run the audit
if (import.meta.url === `file://${process.argv[1]}`) {
  const auditor = new PerformanceAuditor();
  auditor.auditProject().catch(console.error);
}

export { PerformanceAuditor };
