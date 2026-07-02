import { useEffect, useState } from 'react';
import { Alert, Button } from '@mui/material';
import { GetApp } from '@mui/icons-material';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferred || dismissed) return null;

  return (
    <Alert
      severity="info"
      sx={{ borderRadius: 2, mb: 2 }}
      action={
        <Button
          color="inherit"
          size="small"
          startIcon={<GetApp />}
          onClick={async () => {
            await deferred.prompt();
            setDismissed(true);
            setDeferred(null);
          }}
        >
          Instalar
        </Button>
      }
    >
      Instale o SIGAPS no celular para acesso rápido à sua microárea.
    </Alert>
  );
}
