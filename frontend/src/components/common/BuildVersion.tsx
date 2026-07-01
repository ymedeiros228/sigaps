import { useEffect, useState } from 'react';
import { Typography } from '@mui/material';

export function BuildVersion() {
  const [commit, setCommit] = useState<string | null>(null);

  useEffect(() => {
    fetch('/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.commit) setCommit(String(data.commit).slice(0, 7));
      })
      .catch(() => {});
  }, []);

  if (!commit) return null;

  return (
    <Typography
      variant="caption"
      component="span"
      title={`Versão ${commit}`}
      sx={{
        position: 'fixed',
        bottom: 6,
        right: 10,
        opacity: 0.4,
        zIndex: 1200,
        pointerEvents: 'none',
        fontSize: '0.65rem',
        fontFamily: 'monospace',
      }}
    >
      {commit}
    </Typography>
  );
}
