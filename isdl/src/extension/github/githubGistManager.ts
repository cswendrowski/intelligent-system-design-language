import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GitHubAuthProvider } from './githubAuthProvider.js';
import { Octokit } from '@octokit/rest';

export interface GitHubGist {
    id: string;
    description: string;
    public: boolean;
    html_url: string;
    created_at: string;
    updated_at: string;
    files: { [filename: string]: { content?: string; size: number; } };
}

export class GitHubGistManager {
    private octokit: Octokit | null = null;
    private currentGist: GitHubGist | null = null;
    private _onDidChangeState = new vscode.EventEmitter<void>();
    readonly onDidChangeState = this._onDidChangeState.event;

    constructor(
        private _authProvider: GitHubAuthProvider
    ) {}

    /**
     * Initialize Octokit with authentication
     */
    private async initializeOctokit(): Promise<boolean> {
        if (this.octokit) return true;

        try {
            const session = await this._authProvider.getCurrentSession();

            if (!session) return false;

            this.octokit = new Octokit({
                auth: session.accessToken,
                userAgent: 'ISDL-VSCode-Extension'
            });

            return true;
        } catch (error) {
            console.error('Failed to initialize Octokit for Gists:', error);
            return false;
        }
    }

    /**
     * Check if user is authenticated
     */
    async isAuthenticated(): Promise<boolean> {
        return await this.initializeOctokit();
    }

    /**
     * List user's gists
     */
    async listGists(): Promise<GitHubGist[]> {
        if (!await this.initializeOctokit()) return [];

        try {
            const response = await this.octokit!.gists.list({
                per_page: 100
            });

            // Filter for gists that contain .isdl files
            const isdlGists = response.data.filter(gist => {
                return Object.keys(gist.files || {}).some(filename => 
                    filename.endsWith('.isdl') || filename.endsWith('.fsdl')
                );
            });

            return isdlGists.map(gist => ({
                id: gist.id!,
                description: gist.description || 'No description',
                public: gist.public || false,
                html_url: gist.html_url!,
                created_at: gist.created_at!,
                updated_at: gist.updated_at!,
                files: Object.fromEntries(
                    Object.entries(gist.files || {}).map(([filename, file]) => [
                        filename,
                        {
                            content: (file as any)?.content,
                            size: file?.size || 0
                        }
                    ])
                )
            }));
        } catch (error) {
            console.error('Failed to list gists:', error);
            vscode.window.showErrorMessage('Failed to load gists. Please check your connection.');
            return [];
        }
    }

    /**
     * Create a new gist with ISDL file
     */
    async createGist(description: string, isPublic: boolean, isdlFilePath: string): Promise<GitHubGist | undefined> {
        if (!await this.initializeOctokit()) return undefined;

        try {
            const isdlContent = fs.readFileSync(isdlFilePath, 'utf8');
            const filename = path.basename(isdlFilePath);

            const response = await this.octokit!.gists.create({
                description,
                public: isPublic,
                files: {
                    [filename]: {
                        content: isdlContent
                    }
                }
            });

            const gist: GitHubGist = {
                id: response.data.id!,
                description: response.data.description || 'No description',
                public: response.data.public || false,
                html_url: response.data.html_url!,
                created_at: response.data.created_at!,
                updated_at: response.data.updated_at!,
                files: Object.fromEntries(
                    Object.entries(response.data.files || {}).map(([filename, file]) => [
                        filename,
                        {
                            content: (file as any)?.content,
                            size: (file as any)?.size || 0
                        }
                    ])
                )
            };

            this.currentGist = gist;
            this._onDidChangeState.fire();
            
            return gist;
        } catch (error: any) {
            console.error('Failed to create gist:', error);
            vscode.window.showErrorMessage(`Failed to create gist: ${error.message}`);
            return undefined;
        }
    }

    /**
     * Update an existing gist with new ISDL content
     */
    async updateGist(gistId: string, isdlFilePath: string): Promise<boolean> {
        if (!await this.initializeOctokit()) return false;

        try {
            const isdlContent = fs.readFileSync(isdlFilePath, 'utf8');
            const filename = path.basename(isdlFilePath);

            // Get current gist to preserve other files
            const currentGist = await this.octokit!.gists.get({ gist_id: gistId });
            
            // Find existing ISDL file or use the new filename
            let targetFilename = filename;
            const existingIsdlFile = Object.keys(currentGist.data.files || {})
                .find(name => name.endsWith('.isdl') || name.endsWith('.fsdl'));
            
            if (existingIsdlFile) {
                targetFilename = existingIsdlFile;
            }

            await this.octokit!.gists.update({
                gist_id: gistId,
                files: {
                    [targetFilename]: {
                        content: isdlContent
                    }
                }
            });

            console.log(`✅ Gist updated: ${targetFilename}`);
            return true;
        } catch (error: any) {
            console.error('Failed to update gist:', error);
            vscode.window.showErrorMessage(`Failed to update gist: ${error.message}`);
            return false;
        }
    }

    /**
     * Download ISDL content from a gist
     */
    async downloadFromGist(gistId: string): Promise<{ filename: string; content: string } | undefined> {
        if (!await this.initializeOctokit()) return undefined;

        try {
            const response = await this.octokit!.gists.get({ gist_id: gistId });
            
            // Find the ISDL file
            const isdlFile = Object.entries(response.data.files || {})
                .find(([filename]) => filename.endsWith('.isdl') || filename.endsWith('.fsdl'));

            if (!isdlFile) {
                vscode.window.showErrorMessage('No ISDL file found in this gist.');
                return undefined;
            }

            const [filename, fileData] = isdlFile;
            
            if (!fileData?.content) {
                vscode.window.showErrorMessage('Could not retrieve file content from gist.');
                return undefined;
            }

            return {
                filename,
                content: fileData.content
            };
        } catch (error: any) {
            console.error('Failed to download from gist:', error);
            vscode.window.showErrorMessage(`Failed to download from gist: ${error.message}`);
            return undefined;
        }
    }

    /**
     * Set the current gist
     */
    setCurrentGist(gist: GitHubGist): void {
        this.currentGist = gist;
        this._onDidChangeState.fire();
    }

    /**
     * Get current gist
     */
    getCurrentGist(): GitHubGist | null {
        return this.currentGist;
    }

    /**
     * Clear current gist
     */
    disconnectGist(): void {
        this.currentGist = null;
        this._onDidChangeState.fire();
    }

    /**
     * Delete a gist
     */
    async deleteGist(gistId: string): Promise<boolean> {
        if (!await this.initializeOctokit()) return false;

        try {
            await this.octokit!.gists.delete({ gist_id: gistId });
            
            if (this.currentGist?.id === gistId) {
                this.disconnectGist();
            }
            
            return true;
        } catch (error: any) {
            console.error('Failed to delete gist:', error);
            vscode.window.showErrorMessage(`Failed to delete gist: ${error.message}`);
            return false;
        }
    }

    /**
     * Get gist details by ID
     */
    async getGist(gistId: string): Promise<GitHubGist | undefined> {
        if (!await this.initializeOctokit()) return undefined;

        try {
            const response = await this.octokit!.gists.get({ gist_id: gistId });
            
            return {
                id: response.data.id!,
                description: response.data.description || 'No description',
                public: response.data.public || false,
                html_url: response.data.html_url!,
                created_at: response.data.created_at!,
                updated_at: response.data.updated_at!,
                files: Object.fromEntries(
                    Object.entries(response.data.files || {}).map(([filename, file]) => [
                        filename,
                        {
                            content: (file as any)?.content,
                            size: (file as any)?.size || 0
                        }
                    ])
                )
            };
        } catch (error: any) {
            console.error('Failed to get gist:', error);
            return undefined;
        }
    }
}