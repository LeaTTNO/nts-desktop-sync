import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useOneDriveTemplates } from '@/hooks/useOneDriveTemplates';
import { AlertCircle, FolderOpen } from 'lucide-react';
import { OneDriveFolderBrowser } from './OneDriveFolderBrowser';

interface OneDriveTemplateManagerProps {
  language: 'no' | 'da';
  onTemplatesReady?: (ready: boolean) => void;
}

export const OneDriveTemplateManager = ({ language, onTemplatesReady }: OneDriveTemplateManagerProps) => {
  const {
    templates,
    isLoading,
    isAuthenticated,
    categories,
    folderPath,
    lastSyncTime,
    login,
    logout,
    refreshTemplates,
    setCustomFolderPath,
  } = useOneDriveTemplates(language);

  const [showBrowser, setShowBrowser] = useState(false);

  const t = language === 'no' ? {
    title: 'OneDrive Mal-håndtering',
    status: 'Status',
    notAuthenticated: 'Ikke logget inn på OneDrive',
    authenticated: 'Logget inn på OneDrive',
    login: 'Logg inn på OneDrive',
    logout: 'Logg ut',
    language: 'Språk',
    currentLanguage: 'Norsk (NO)',
    folderPath: 'Templates/NO',
    refresh: 'Oppdater maler',
    templatesLoaded: 'maler lastet',
    noTemplates: 'Ingen maler lastet enda',
    loadedTemplates: 'Lastede maler',
    clientIdMissing: 'Azure Client ID mangler',
    clientIdInstructions: 'Legg til VITE_AZURE_CLIENT_ID i .env filen for å aktivere OneDrive-integrasjon.',
    setupTitle: 'Viktig informasjon',
    setupDescription: 'Systemet laster automatisk maler fra OneDrive-mappen basert på valgt språk. Alle brukere må logge inn med sin OneDrive-konto som har tilgang til den delte mappen.',
    lastSync: 'Siste synkronisering',
    autoSync: 'Auto-sync kl 08:00',
    never: 'Aldri',
  } : {
    title: 'OneDrive Skabelon-håndtering',
    status: 'Status',
    notAuthenticated: 'Ikke logget ind på OneDrive',
    authenticated: 'Logget ind på OneDrive',
    login: 'Log ind på OneDrive',
    logout: 'Log ud',
    language: 'Sprog',
    currentLanguage: 'Dansk (DK)',
    folderPath: 'Templates/DK',
    refresh: 'Opdater skabeloner',
    templatesLoaded: 'skabeloner indlæst',
    noTemplates: 'Ingen skabeloner indlæst endnu',
    loadedTemplates: 'Indlæste skabeloner',
    clientIdMissing: 'Azure Client ID mangler',
    clientIdInstructions: 'Tilføj VITE_AZURE_CLIENT_ID i .env filen for at aktivere OneDrive-integration.',
    setupTitle: 'Vigtig information',
    setupDescription: 'Systemet indlæser automatisk skabeloner fra OneDrive-mappen baseret på valgt sprog. Alle brugere skal logge ind med deres OneDrive-konto som har adgang til den delte mappe.',
    lastSync: 'Seneste synkronisering',
    autoSync: 'Auto-sync kl 08:00',
    never: 'Aldrig',
  };

  // Notify parent component when templates change
  useEffect(() => {
    onTemplatesReady?.(templates.length > 0);
  }, [templates, onTemplatesReady]);

  const clientIdConfigured = import.meta.env.VITE_AZURE_CLIENT_ID && 
                             import.meta.env.VITE_AZURE_CLIENT_ID !== 'YOUR_CLIENT_ID_HERE';
  
  console.log('🔑 Azure Client ID configured:', clientIdConfigured);
  console.log('🔑 Client ID value:', import.meta.env.VITE_AZURE_CLIENT_ID);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Azure Client ID Warning */}
        {!clientIdConfigured && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t.clientIdMissing}</AlertTitle>
            <AlertDescription>{t.clientIdInstructions}</AlertDescription>
          </Alert>
        )}

        {/* Setup Info */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t.setupTitle}</AlertTitle>
          <AlertDescription>{t.setupDescription}</AlertDescription>
        </Alert>

        {/* Status Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg">
            <div>
              <p className="font-medium">{t.status}</p>
              <p className="text-sm text-muted-foreground">
                {isAuthenticated ? t.authenticated : t.notAuthenticated}
              </p>
            </div>
            {isAuthenticated ? (
              <Button variant="outline" onClick={logout}>
                {t.logout}
              </Button>
            ) : (
              <Button 
                onClick={() => {
                  console.log('Login button clicked');
                  login();
                }} 
                className="bg-primary text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                {t.login}
              </Button>
            )}
          </div>

          {/* Language & Folder Info */}
          {isAuthenticated && (
            <div className="p-4 bg-primary/5 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t.language}</p>
                  <p className="text-sm text-muted-foreground">{t.currentLanguage}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={refreshTemplates}
                  disabled={isLoading}
                >
                  {t.refresh}
                </Button>
              </div>
              
              {/* Last Sync Time & Auto-sync Info */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t.lastSync}:</span>
                <span className="font-medium">
                  {lastSyncTime 
                    ? new Date(lastSyncTime).toLocaleString(language === 'no' ? 'nb-NO' : 'da-DK', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : t.never
                  }
                </span>
              </div>
              <div className="text-xs text-muted-foreground bg-green-50 dark:bg-green-950/20 px-2 py-1 rounded border border-green-200 dark:border-green-800">
                ✅ {t.autoSync}
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">OneDrive mappe:</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBrowser(!showBrowser)}
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    {showBrowser ? 'Skjul' : 'Bla gjennom'}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground font-mono break-all">
                  {folderPath || 'OneDrive root (/)'}
                </p>
              </div>
              {templates.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {templates.length} {t.templatesLoaded}
                </p>
              )}
            </div>
          )}
          
          {showBrowser && (
            <OneDriveFolderBrowser
              language={language}
              onFolderSelected={(path) => {
                setCustomFolderPath(path);
                setShowBrowser(false);
              }}
            />
          )}
        </div>

        {/* Display loaded templates grouped by category */}
        {isAuthenticated && templates.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t.loadedTemplates}</h3>
            {categories.map(category => {
              const categoryTemplates = templates.filter(t => t.category === category);
              if (categoryTemplates.length === 0) return null;
              
              return (
                <div key={category} className="space-y-2">
                  <h4 className="font-medium capitalize">{category}</h4>
                  <div className="pl-4 space-y-1">
                    {categoryTemplates.map(template => (
                      <div key={template.id} className="text-sm text-muted-foreground">
                        • {template.name}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isAuthenticated && templates.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t.noTemplates}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
