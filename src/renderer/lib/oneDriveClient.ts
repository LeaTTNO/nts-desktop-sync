import { PublicClientApplication, Configuration, AccountInfo } from '@azure/msal-browser';
import { msalConfig as baseConfig } from '@/config/msalConfig';

// Override cache location for OneDrive to persist across sessions
const msalConfig: Configuration = {
  ...baseConfig,
  cache: {
    cacheLocation: 'localStorage', // Use localStorage so login persists
    storeAuthStateInCookie: false,
  },
};

const loginRequest = {
  scopes: [
    'Files.Read',
    'Files.Read.All',
    'Sites.Read.All',
    'User.Read'
  ],
};

class OneDriveClient {
  private msalInstance: PublicClientApplication;
  private account: AccountInfo | null = null;
  private initialized: boolean = false;

  constructor() {
    this.msalInstance = new PublicClientApplication(msalConfig);
  }

  async initialize() {
    // Skip if already initialized
    if (this.initialized) {
      console.log('OneDrive: Already initialized, updating account...');
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        this.account = accounts[0];
        console.log('OneDrive: Using existing account:', this.account.username);
      }
      return;
    }

    try {
      console.log('OneDrive: Starting initialization...');
      await this.msalInstance.initialize();
      console.log('OneDrive: MSAL initialized successfully');
      this.initialized = true;
      
      const accounts = this.msalInstance.getAllAccounts();
      console.log('OneDrive: Found accounts:', accounts.length);
      
      if (accounts.length > 0) {
        this.account = accounts[0];
        console.log('OneDrive: Logged in as:', this.account.username);
        return;
      }
      
      // No accounts found - try silent SSO (Windows integrated auth)
      console.log('OneDrive: No accounts found, attempting Windows SSO...');
      await this.loginSilent();
      
    } catch (error) {
      console.error('OneDrive: Initialization error:', error);
      // Don't throw - we can still try popup login later if needed
    }
  }

  async loginSilent() {
    try {
      console.log('OneDrive: Attempting silent SSO (Windows integrated auth)...');
      
      const response = await this.msalInstance.ssoSilent({
        scopes: loginRequest.scopes,
      });
      
      this.account = response.account;
      this.msalInstance.setActiveAccount(response.account);
      console.log('✅ OneDrive: Silent SSO successful! Logged in as:', this.account.username);
      return response;
    } catch (error) {
      console.log('⚠️ OneDrive: Silent SSO failed:', error);
      // Silent login failed - might need popup
      throw error;
    }
  }

  async login() {
    try {
      console.log('OneDrive: Starting login popup...');
      console.log('OneDrive: Client ID:', msalConfig.auth.clientId);
      console.log('OneDrive: Redirect URI:', msalConfig.auth.redirectUri);
      
      const response = await this.msalInstance.loginPopup(loginRequest);
      this.account = response.account;
      console.log('OneDrive: Login successful, user:', response.account.username);
      return response;
    } catch (error) {
      console.error('OneDrive: Login failed with error:', error);
      if (error instanceof Error) {
        console.error('OneDrive: Error message:', error.message);
        console.error('OneDrive: Error stack:', error.stack);
      }
      throw error;
    }
  }

  async logout() {
    if (this.account) {
      await this.msalInstance.logoutPopup({ account: this.account });
      this.account = null;
    }
  }

  isAuthenticated(): boolean {
    return this.account !== null;
  }

  getAccount(): AccountInfo | null {
    return this.account;
  }

  private async getAccessToken(): Promise<string> {
    if (!this.account) {
      throw new Error('No account logged in');
    }

    try {
      const response = await this.msalInstance.acquireTokenSilent({
        scopes: loginRequest.scopes,
        account: this.account,
      });
      return response.accessToken;
    } catch (error) {
      // Token expired, get new one with popup
      const response = await this.msalInstance.acquireTokenPopup(loginRequest);
      return response.accessToken;
    }
  }

  async listFilesInFolder(folderPath: string = ''): Promise<any[]> {
    const token = await this.getAccessToken();
    
    console.log('📁 OneDrive: Starting to list files...');
    console.log('📁 OneDrive: Folder path requested:', folderPath || '(root)');
    
    // Build the API URL
    let url = 'https://graph.microsoft.com/v1.0/me/drive/root';
    if (folderPath) {
      // URL encode the path properly
      const encodedPath = folderPath.split('/').map(encodeURIComponent).join('/');
      url += `:/${encodedPath}:/children`;
    } else {
      url += '/children';
    }

    console.log('📁 OneDrive: API URL:', url);
    console.log('📁 OneDrive: Making request...');

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📁 OneDrive: Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ OneDrive: List files failed:', {
        status: response.status,
        statusText: response.statusText,
        folderPath,
        url,
        error: errorData
      });
      throw new Error(`Failed to list files in "${folderPath}": ${response.statusText}. Sjekk at mappen eksisterer i OneDrive.`);
    }

    const data = await response.json();
    console.log('✅ OneDrive: Successfully fetched data');
    console.log('📁 OneDrive: Number of items found:', data.value?.length || 0);
    console.log('📁 OneDrive: Items:', data.value?.map((item: any) => ({
      name: item.name,
      isFolder: !!item.folder,
      id: item.id
    })));
    
    return data.value || [];
  }

  async getRootFolders(): Promise<any[]> {
    return this.listFilesInFolder('');
  }

  async listAllDrives(): Promise<any[]> {
    const token = await this.getAccessToken();
    
    console.log('💾 OneDrive: Listing all available drives...');
    
    const url = 'https://graph.microsoft.com/v1.0/me/drives';
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ OneDrive: Failed to list drives:', response.statusText);
      throw new Error(`Failed to list drives: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ OneDrive: Found drives:', data.value?.length || 0);
    console.log('💾 Drives:', data.value?.map((d: any) => ({
      name: d.name,
      driveType: d.driveType,
      id: d.id
    })));
    
    return data.value || [];
  }

  async listFilesInDrive(driveId: string, folderPath: string = ''): Promise<any[]> {
    const token = await this.getAccessToken();
    
    console.log('📁 OneDrive: Listing files in drive:', driveId);
    console.log('📁 OneDrive: Folder path:', folderPath || '(root)');
    
    let url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root`;
    if (folderPath) {
      const encodedPath = folderPath.split('/').map(encodeURIComponent).join('/');
      url += `:/${encodedPath}:/children`;
    } else {
      url += '/children';
    }

    console.log('📁 OneDrive: API URL:', url);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📁 OneDrive: Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ OneDrive: List files failed:', errorData);
      throw new Error(`Failed to list files: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ OneDrive: Found items:', data.value?.length || 0);
    
    return data.value || [];
  }

  async getSharedWithMe(): Promise<any[]> {
    const token = await this.getAccessToken();
    
    console.log('🔗 OneDrive: Fetching shared items...');
    
    const url = 'https://graph.microsoft.com/v1.0/me/drive/sharedWithMe';
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ OneDrive: Failed to get shared items:', response.statusText);
      throw new Error(`Failed to get shared items: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ OneDrive: Found shared items:', data.value?.length || 0);
    
    return data.value || [];
  }

  async listSharePointSites(): Promise<any[]> {
    const token = await this.getAccessToken();
    
    console.log('🏢 OneDrive: Fetching SharePoint sites...');
    
    const url = 'https://graph.microsoft.com/v1.0/sites?search=*';
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ OneDrive: Failed to list SharePoint sites:', response.statusText);
      throw new Error(`Failed to list SharePoint sites: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ OneDrive: Found SharePoint sites:', data.value?.length || 0);
    console.log('🏢 Sites:', data.value?.map((s: any) => ({
      name: s.displayName || s.name,
      id: s.id,
      webUrl: s.webUrl
    })));
    
    return data.value || [];
  }

  async listSiteDrives(siteId: string): Promise<any[]> {
    const token = await this.getAccessToken();
    
    console.log('📚 OneDrive: Fetching drives for site:', siteId);
    
    const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ OneDrive: Failed to list site drives:', response.statusText);
      throw new Error(`Failed to list site drives: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ OneDrive: Found drives in site:', data.value?.length || 0);
    
    return data.value || [];
  }

  async searchFiles(query: string): Promise<any[]> {
    const token = await this.getAccessToken();
    
    const url = `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(query)}')`;
    
    console.log('OneDrive: Searching for:', query);
    console.log('OneDrive: Search URL:', url);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('OneDrive: Search failed:', response.statusText);
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('OneDrive: Search results:', data.value?.length || 0);
    return data.value || [];
  }

  async getDriveInfo(): Promise<any> {
    const token = await this.getAccessToken();
    
    const url = 'https://graph.microsoft.com/v1.0/me/drive';
    
    console.log('📊 OneDrive: Fetching drive info...');
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ OneDrive: Failed to get drive info:', response.statusText);
      throw new Error(`Failed to get drive info: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ OneDrive: Drive info retrieved:', {
      driveType: data.driveType,
      owner: data.owner?.user?.displayName,
      id: data.id
    });
    return data;
  }


  async downloadFile(fileId: string): Promise<Blob> {
    const token = await this.getAccessToken();
    
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    return await response.blob();
  }

  /**
   * Fetch initial delta link for a folder path.
   * Call once after a full sync to get a baseline token for future incremental syncs.
   */
  async initDeltaLink(folderPath: string = ''): Promise<string> {
    const token = await this.getAccessToken();

    let url: string;
    if (folderPath) {
      const encodedPath = folderPath.split('/').map(encodeURIComponent).join('/');
      url = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/delta?$select=id,name,file,folder,deleted,parentReference,lastModifiedDateTime&$top=1`;
    } else {
      url = `https://graph.microsoft.com/v1.0/me/drive/root/delta?$select=id,name,file,folder,deleted,parentReference,lastModifiedDateTime&$top=1`;
    }

    // Page through to reach the final deltaLink (we don't care about items here)
    let nextLink: string | null = url;
    let deltaLink = '';

    while (nextLink) {
      const response = await fetch(nextLink, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`initDeltaLink failed: ${response.statusText}`);
      const data = await response.json();

      if (data['@odata.deltaLink']) {
        deltaLink = data['@odata.deltaLink'];
        nextLink = null;
      } else {
        nextLink = data['@odata.nextLink'] || null;
      }
    }

    return deltaLink;
  }

  /**
   * Fetch only changed/new/deleted drive items since the last deltaLink token.
   * Returns the changed items and a new deltaLink to use next time.
   */
  async getDeltaChanges(deltaLink: string): Promise<{
    changed: any[];
    deleted: string[];
    nextDeltaLink: string;
  }> {
    const token = await this.getAccessToken();
    const changed: any[] = [];
    const deleted: string[] = [];
    let nextLink: string | null = deltaLink;
    let nextDeltaLink = '';

    while (nextLink) {
      const response = await fetch(nextLink, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        // 410 Gone = delta token expired; caller should fall back to full sync
        if (response.status === 410) {
          throw new Error('DELTA_EXPIRED');
        }
        throw new Error(`getDeltaChanges failed: ${response.statusText}`);
      }

      const data = await response.json();

      for (const item of data.value || []) {
        if (item.deleted) {
          deleted.push(item.id);
        } else {
          changed.push(item);
        }
      }

      if (data['@odata.deltaLink']) {
        nextDeltaLink = data['@odata.deltaLink'];
        nextLink = null;
      } else {
        nextLink = data['@odata.nextLink'] || null;
      }
    }

    return { changed, deleted, nextDeltaLink };
  }

  async searchPowerPointFiles(folderPath: string = ''): Promise<any[]> {
    const files = await this.listFilesInFolder(folderPath);
    return files.filter(file => {
      const name = file.name.toLowerCase();
      return name.endsWith('.pptx') || name.endsWith('.ppt');
    });
  }

  async searchPowerPointFilesRecursive(basePath: string = ''): Promise<Array<{ file: any; folderName: string; fullPath: string }>> {
    const result: Array<{ file: any; folderName: string; fullPath: string }> = [];
    
    async function searchFolder(path: string, folderName: string) {
      try {
        const items = await oneDriveClient.listFilesInFolder(path);
        
        for (const item of items) {
          if (item.folder) {
            // It's a subfolder - search recursively
            const subPath = path ? `${path}/${item.name}` : item.name;
            await searchFolder(subPath, item.name);
          } else if (item.file) {
            // It's a file - check if PowerPoint
            const name = item.name.toLowerCase();
            if (name.endsWith('.pptx') || name.endsWith('.ppt')) {
              const fullPath = path ? `${path}/${item.name}` : item.name;
              result.push({ 
                file: item, 
                folderName: folderName || 'root', 
                fullPath 
              });
            }
          }
        }
      } catch (error) {
        console.warn(`Could not access folder: ${path}`, error);
      }
    }
    
    await searchFolder(basePath, basePath || 'root');
    return result;
  }
}

export const oneDriveClient = new OneDriveClient();
