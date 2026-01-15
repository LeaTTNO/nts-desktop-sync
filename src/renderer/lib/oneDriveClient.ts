import { PublicClientApplication, Configuration, AccountInfo } from '@azure/msal-browser';

// MSAL configuration - brukeren må legge til sin egen clientId fra Azure AD
const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || 'YOUR_CLIENT_ID_HERE',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
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

  constructor() {
    this.msalInstance = new PublicClientApplication(msalConfig);
  }

  async initialize() {
    try {
      console.log('OneDrive: Starting initialization...');
      await this.msalInstance.initialize();
      console.log('OneDrive: MSAL initialized successfully');
      
      const accounts = this.msalInstance.getAllAccounts();
      console.log('OneDrive: Found accounts:', accounts.length);
      
      if (accounts.length > 0) {
        this.account = accounts[0];
        console.log('OneDrive: Logged in as:', this.account.username);
      } else {
        console.log('OneDrive: No accounts found');
      }
    } catch (error) {
      console.error('OneDrive: Initialization error:', error);
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

  async searchPowerPointFiles(folderPath: string = ''): Promise<any[]> {
    const files = await this.listFilesInFolder(folderPath);
    return files.filter(file => {
      const name = file.name.toLowerCase();
      return name.endsWith('.pptx') || name.endsWith('.ppt');
    });
  }
}

export const oneDriveClient = new OneDriveClient();
