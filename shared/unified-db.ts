// TODO: Phase 1.3 - Unified IndexedDB Schema
// Clean, unified database implementation using Dexie for the new architecture
// No migration logic needed - fresh start approach

import Dexie, { Table } from "dexie";
import { UnifiedCanvas, UnifiedProject } from "./types";

// Settings interface for app preferences
export interface AppSettings {
  key: string;
  value: unknown;
  updatedAt: Date;
}

// Project export data interface
export interface ProjectExportData {
  project: UnifiedProject;
  canvases: UnifiedCanvas[];
  exportedAt: Date;
  format: 'json' | 'zip';
}

// Database version and schema
export class UnifiedDexie extends Dexie {
  canvases!: Table<UnifiedCanvas>;
  projects!: Table<UnifiedProject>;
  settings!: Table<AppSettings>;

  constructor() {
    super("ExcaliOrgUnifiedDB");

    this.version(1).stores({
      // Canvases table with indexes for performance
      canvases: "id, name, projectId, createdAt, updatedAt, lastModified",

      // Projects table with indexes
      projects: "id, name, createdAt, updatedAt, color",

      // Settings table for app preferences
      settings: "key, updatedAt",
    });
  }
}

// Create singleton database instance
export const unifiedDb = new UnifiedDexie();

// Core Canvas Operations
export const canvasOperations = {
  /**
   * Get all canvases sorted by updatedAt (most recent first)
   */
  async getAllCanvases(): Promise<UnifiedCanvas[]> {
    try {
      return await unifiedDb.canvases.orderBy("updatedAt").reverse().toArray();
    } catch (error) {
      console.error("Failed to get all canvases:", error);
      throw new Error("Database error: Could not retrieve canvases");
    }
  },

  /**
   * Get canvas by ID
   */
  async getCanvas(id: string): Promise<UnifiedCanvas | undefined> {
    try {
      return await unifiedDb.canvases.get(id);
    } catch (error) {
      console.error(`Failed to get canvas ${id}:`, error);
      throw new Error(`Database error: Could not retrieve canvas ${id}`);
    }
  },

  /**
   * Add new canvas
   */
  async addCanvas(canvas: UnifiedCanvas): Promise<void> {
    try {
      // Validate canvas data
      if (!canvas.id || !canvas.name) {
        throw new Error("Canvas must have id and name");
      }

      // Ensure timestamps
      const now = new Date();
      if (!canvas.createdAt) canvas.createdAt = now;
      if (!canvas.updatedAt) canvas.updatedAt = now;
      if (!canvas.lastModified) canvas.lastModified = now.toISOString();

      await unifiedDb.canvases.add(canvas);
    } catch (error) {
      console.error("Failed to add canvas:", error);
      throw new Error("Database error: Could not add canvas");
    }
  },

  /**
   * Update existing canvas
   */
  async updateCanvas(canvas: UnifiedCanvas): Promise<void> {
    try {
      // Update timestamp
      canvas.updatedAt = new Date();
      canvas.lastModified = canvas.updatedAt.toISOString();

      await unifiedDb.canvases.put(canvas);
    } catch (error) {
      console.error("Failed to update canvas:", error);
      throw new Error("Database error: Could not update canvas");
    }
  },

  /**
   * Delete canvas by ID
   */
  async deleteCanvas(id: string): Promise<void> {
    try {
      await unifiedDb.canvases.delete(id);

      // Remove canvas from all projects
      const projects = await unifiedDb.projects.toArray();
      for (const project of projects) {
        if (project.canvasIds.includes(id)) {
          project.canvasIds = project.canvasIds.filter(
            (canvasId) => canvasId !== id,
          );
          if (project.fileIds) {
            project.fileIds = project.fileIds.filter((fileId) => fileId !== id);
          }
          await unifiedDb.projects.put(project);
        }
      }
    } catch (error) {
      console.error("Failed to delete canvas:", error);
      throw new Error("Database error: Could not delete canvas");
    }
  },

  /**
   * Get canvases for a specific project
   */
  async getCanvasesForProject(projectId: string): Promise<UnifiedCanvas[]> {
    try {
      return await unifiedDb.canvases
        .where("projectId")
        .equals(projectId)
        .sortBy("updatedAt");
    } catch (error) {
      console.error(`Failed to get canvases for project ${projectId}:`, error);
      throw new Error("Database error: Could not retrieve project canvases");
    }
  },

  /**
   * Get unorganized canvases (not in any project)
   */
  async getUnorganizedCanvases(): Promise<UnifiedCanvas[]> {
    try {
      return await unifiedDb.canvases
        .where("projectId")
        .equals("")
        .or("projectId")
        .below("")
        .sortBy("updatedAt");
    } catch (error) {
      console.error("Failed to get unorganized canvases:", error);
      throw new Error(
        "Database error: Could not retrieve unorganized canvases",
      );
    }
  },

  /**
   * Bulk delete canvases
   */
  async bulkDeleteCanvases(canvasIds: string[]): Promise<void> {
    try {
      await unifiedDb.canvases.bulkDelete(canvasIds);

      // Remove canvases from all projects
      const projects = await unifiedDb.projects.toArray();
      for (const project of projects) {
        const originalLength = project.canvasIds.length;
        project.canvasIds = project.canvasIds.filter(
          (id) => !canvasIds.includes(id),
        );
        if (project.fileIds) {
          project.fileIds = project.fileIds.filter(
            (id) => !canvasIds.includes(id),
          );
        }

        // Only update if changes were made
        if (project.canvasIds.length !== originalLength) {
          await unifiedDb.projects.put(project);
        }
      }
    } catch (error) {
      console.error("Failed to bulk delete canvases:", error);
      throw new Error("Database error: Could not delete canvases");
    }
  },
};

// Core Project Operations
export const projectOperations = {
  /**
   * Get all projects sorted by createdAt
   */
  async getAllProjects(): Promise<UnifiedProject[]> {
    try {
      return await unifiedDb.projects.orderBy("createdAt").toArray();
    } catch (error) {
      console.error("Failed to get all projects:", error);
      throw new Error("Database error: Could not retrieve projects");
    }
  },

  /**
   * Get project by ID
   */
  async getProject(id: string): Promise<UnifiedProject | undefined> {
    try {
      return await unifiedDb.projects.get(id);
    } catch (error) {
      console.error(`Failed to get project ${id}:`, error);
      throw new Error(`Database error: Could not retrieve project ${id}`);
    }
  },

  /**
   * Add new project
   */
  async addProject(project: UnifiedProject): Promise<void> {
    try {
      // Validate project data
      if (!project.id || !project.name || !project.color) {
        throw new Error("Project must have id, name, and color");
      }

      // Ensure timestamps and arrays
      const now = new Date();
      if (!project.createdAt) project.createdAt = now;
      if (!project.updatedAt) project.updatedAt = now;
      if (!project.canvasIds) project.canvasIds = [];

      await unifiedDb.projects.add(project);
    } catch (error) {
      console.error("Failed to add project:", error);
      throw new Error("Database error: Could not add project");
    }
  },

  /**
   * Update existing project
   */
  async updateProject(project: UnifiedProject): Promise<void> {
    try {
      // Update timestamp
      project.updatedAt = new Date();

      await unifiedDb.projects.put(project);
    } catch (error) {
      console.error("Failed to update project:", error);
      throw new Error("Database error: Could not update project");
    }
  },

  /**
   * Delete project by ID
   */
  async deleteProject(id: string): Promise<void> {
    try {
      // Get project to find associated canvases
      const project = await unifiedDb.projects.get(id);

      await unifiedDb.projects.delete(id);

      // Remove project association from canvases
      if (project && project.canvasIds.length > 0) {
        const canvases = await unifiedDb.canvases
          .where("id")
          .anyOf(project.canvasIds)
          .toArray();

        for (const canvas of canvases) {
          canvas.projectId = undefined;
          await unifiedDb.canvases.put(canvas);
        }
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
      throw new Error("Database error: Could not delete project");
    }
  },

  /**
   * Enhanced delete project with canvas handling options
   */
  async deleteProjectWithOptions(
    id: string,
    canvasAction: 'keep' | 'delete' = 'keep'
  ): Promise<{ deletedCanvasCount: number }> {
    try {
      // Get project to find associated canvases
      const project = await unifiedDb.projects.get(id);
      if (!project) {
        throw new Error(`Project ${id} not found`);
      }

      let deletedCanvasCount = 0;

      // Handle canvas actions
      if (project.canvasIds.length > 0) {
        const canvases = await unifiedDb.canvases
          .where("id")
          .anyOf(project.canvasIds)
          .toArray();

        if (canvasAction === 'delete') {
          // Delete all canvases in the project
          await unifiedDb.canvases.bulkDelete(project.canvasIds);
          deletedCanvasCount = canvases.length;
        } else {
          // Keep canvases but remove project association
          for (const canvas of canvases) {
            canvas.projectId = undefined;
            await unifiedDb.canvases.put(canvas);
          }
        }
      }

      // Delete the project
      await unifiedDb.projects.delete(id);

      return { deletedCanvasCount };
    } catch (error) {
      console.error("Failed to delete project with options:", error);
      throw new Error("Database error: Could not delete project");
    }
  },

  /**
   * Rename project with validation
   */
  async renameProject(projectId: string, newName: string): Promise<UnifiedProject> {
    try {
      // Validate new name
      const trimmedName = newName.trim();
      if (!trimmedName) {
        throw new Error("Project name cannot be empty");
      }

      // Check for duplicate names
      const isDuplicate = await this.validateProjectName(trimmedName, projectId);
      if (!isDuplicate) {
        throw new Error("A project with this name already exists");
      }

      // Get and update project
      const project = await unifiedDb.projects.get(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      project.name = trimmedName;
      project.updatedAt = new Date();

      await unifiedDb.projects.put(project);

      return project;
    } catch (error) {
      console.error("Failed to rename project:", error);
      throw new Error("Database error: Could not rename project");
    }
  },

  /**
   * Validate project name (returns true if valid/unique)
   */
  async validateProjectName(name: string, excludeId?: string): Promise<boolean> {
    try {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return false;
      }

      // Check for existing project with same name
      const existingProjects = await unifiedDb.projects
        .where("name")
        .equalsIgnoreCase(trimmedName)
        .toArray();

      // If excluding an ID, filter it out
      const duplicates = excludeId 
        ? existingProjects.filter(p => p.id !== excludeId)
        : existingProjects;

      return duplicates.length === 0;
    } catch (error) {
      console.error("Failed to validate project name:", error);
      return false;
    }
  },

  /**
   * Export project data with all associated canvases
   */
  async exportProject(projectId: string): Promise<ProjectExportData> {
    try {
      // Get project
      const project = await unifiedDb.projects.get(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      // Get all canvases for this project
      const canvases = await unifiedDb.canvases
        .where("id")
        .anyOf(project.canvasIds)
        .toArray();

      return {
        project,
        canvases,
        exportedAt: new Date(),
        format: 'zip'
      };
    } catch (error) {
      console.error("Failed to export project:", error);
      throw new Error("Database error: Could not export project");
    }
  },

  /**
   * Add canvas to project
   */
  async addCanvasToProject(canvasId: string, projectId: string): Promise<void> {
    try {
      // Update canvas
      const canvas = await unifiedDb.canvases.get(canvasId);
      if (!canvas) {
        throw new Error(`Canvas ${canvasId} not found`);
      }

      canvas.projectId = projectId;
      await unifiedDb.canvases.put(canvas);

      // Update project
      const project = await unifiedDb.projects.get(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      if (!project.canvasIds.includes(canvasId)) {
        project.canvasIds.push(canvasId);
        if (project.fileIds && !project.fileIds.includes(canvasId)) {
          project.fileIds.push(canvasId);
        }
        await unifiedDb.projects.put(project);
      }
    } catch (error) {
      console.error("Failed to add canvas to project:", error);
      throw new Error("Database error: Could not add canvas to project");
    }
  },

  /**
   * Remove canvas from project
   */
  async removeCanvasFromProject(
    canvasId: string,
    projectId: string,
  ): Promise<void> {
    try {
      // Update canvas
      const canvas = await unifiedDb.canvases.get(canvasId);
      if (canvas && canvas.projectId === projectId) {
        canvas.projectId = undefined;
        await unifiedDb.canvases.put(canvas);
      }

      // Update project
      const project = await unifiedDb.projects.get(projectId);
      if (project) {
        project.canvasIds = project.canvasIds.filter((id) => id !== canvasId);
        if (project.fileIds) {
          project.fileIds = project.fileIds.filter((id) => id !== canvasId);
        }
        await unifiedDb.projects.put(project);
      }
    } catch (error) {
      console.error("Failed to remove canvas from project:", error);
      throw new Error("Database error: Could not remove canvas from project");
    }
  },
};

// Settings Management
export const settingsOperations = {
  /**
   * Get setting value by key
   */
  async getSetting<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    try {
      const setting = await unifiedDb.settings.get(key);
      return setting ? (setting.value as T) : defaultValue;
    } catch (error) {
      console.error(`Failed to get setting ${key}:`, error);
      return defaultValue;
    }
  },

  /**
   * Set setting value
   */
  async setSetting<T>(key: string, value: T): Promise<void> {
    try {
      const setting: AppSettings = {
        key,
        value,
        updatedAt: new Date(),
      };

      await unifiedDb.settings.put(setting);
    } catch (error) {
      console.error(`Failed to set setting ${key}:`, error);
      throw new Error("Database error: Could not save setting");
    }
  },

  /**
   * Get all settings
   */
  async getAllSettings(): Promise<Record<string, unknown>> {
    try {
      const settings = await unifiedDb.settings.toArray();
      const result: Record<string, unknown> = {};

      for (const setting of settings) {
        result[setting.key] = setting.value;
      }

      return result;
    } catch (error) {
      console.error("Failed to get all settings:", error);
      return {};
    }
  },

  /**
   * Delete setting
   */
  async deleteSetting(key: string): Promise<void> {
    try {
      await unifiedDb.settings.delete(key);
    } catch (error) {
      console.error(`Failed to delete setting ${key}:`, error);
      throw new Error("Database error: Could not delete setting");
    }
  },
};

// Bulk Operations for Performance
export const bulkOperations = {
  /**
   * Bulk add canvases
   */
  async bulkAddCanvases(canvases: UnifiedCanvas[]): Promise<void> {
    try {
      const now = new Date();
      const processedCanvases = canvases.map((canvas) => {
        if (!canvas.createdAt) canvas.createdAt = now;
        if (!canvas.updatedAt) canvas.updatedAt = now;
        if (!canvas.lastModified) canvas.lastModified = now.toISOString();
        return canvas;
      });

      await unifiedDb.canvases.bulkAdd(processedCanvases);
    } catch (error) {
      console.error("Failed to bulk add canvases:", error);
      throw new Error("Database error: Could not bulk add canvases");
    }
  },

  /**
   * Bulk add projects
   */
  async bulkAddProjects(projects: UnifiedProject[]): Promise<void> {
    try {
      const now = new Date();
      const processedProjects = projects.map((project) => {
        if (!project.createdAt) project.createdAt = now;
        if (!project.updatedAt) project.updatedAt = now;
        if (!project.canvasIds) project.canvasIds = [];
        return project;
      });

      await unifiedDb.projects.bulkAdd(processedProjects);
    } catch (error) {
      console.error("Failed to bulk add projects:", error);
      throw new Error("Database error: Could not bulk add projects");
    }
  },
};

// Backup and Restore Functionality
export const backupOperations = {
  /**
   * Export all data for backup
   */
  async exportAllData(): Promise<{
    canvases: UnifiedCanvas[];
    projects: UnifiedProject[];
    settings: AppSettings[];
  }> {
    try {
      const [canvases, projects, settings] = await Promise.all([
        unifiedDb.canvases.toArray(),
        unifiedDb.projects.toArray(),
        unifiedDb.settings.toArray(),
      ]);

      return { canvases, projects, settings };
    } catch (error) {
      console.error("Failed to export data:", error);
      throw new Error("Database error: Could not export data");
    }
  },

  /**
   * Import data from backup (clears existing data)
   */
  async importAllData(data: {
    canvases: UnifiedCanvas[];
    projects: UnifiedProject[];
    settings?: AppSettings[];
  }): Promise<void> {
    try {
      await unifiedDb.transaction(
        "rw",
        unifiedDb.canvases,
        unifiedDb.projects,
        unifiedDb.settings,
        async () => {
          // Clear existing data
          await unifiedDb.canvases.clear();
          await unifiedDb.projects.clear();
          await unifiedDb.settings.clear();

          // Import new data
          if (data.canvases.length > 0) {
            await unifiedDb.canvases.bulkAdd(data.canvases);
          }
          if (data.projects.length > 0) {
            await unifiedDb.projects.bulkAdd(data.projects);
          }
          if (data.settings && data.settings.length > 0) {
            await unifiedDb.settings.bulkAdd(data.settings);
          }
        },
      );
    } catch (error) {
      console.error("Failed to import data:", error);
      throw new Error("Database error: Could not import data");
    }
  },
};

// Database Utility Functions
export const dbUtils = {
  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    canvasCount: number;
    projectCount: number;
    settingsCount: number;
  }> {
    try {
      const [canvasCount, projectCount, settingsCount] = await Promise.all([
        unifiedDb.canvases.count(),
        unifiedDb.projects.count(),
        unifiedDb.settings.count(),
      ]);

      return { canvasCount, projectCount, settingsCount };
    } catch (error) {
      console.error("Failed to get database stats:", error);
      return { canvasCount: 0, projectCount: 0, settingsCount: 0 };
    }
  },

  /**
   * Clear all data (for development/testing)
   */
  async clearAllData(): Promise<void> {
    try {
      await unifiedDb.transaction(
        "rw",
        unifiedDb.canvases,
        unifiedDb.projects,
        unifiedDb.settings,
        async () => {
          await unifiedDb.canvases.clear();
          await unifiedDb.projects.clear();
          await unifiedDb.settings.clear();
        },
      );
    } catch (error) {
      console.error("Failed to clear all data:", error);
      throw new Error("Database error: Could not clear data");
    }
  },

  /**
   * Check if database is accessible
   */
  async isAccessible(): Promise<boolean> {
    try {
      await unifiedDb.canvases.limit(1).toArray();
      return true;
    } catch (error) {
      console.error("Database accessibility check failed:", error);
      return false;
    }
  },
};

// Initialize database
export async function initializeDatabase(): Promise<void> {
  try {
    await unifiedDb.open();
    console.log("Unified database initialized successfully");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw new Error("Database initialization failed");
  }
}
