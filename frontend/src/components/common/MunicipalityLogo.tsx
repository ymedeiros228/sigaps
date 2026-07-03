import { useEffect, useState } from 'react';
import { Box, type BoxProps } from '@mui/material';
import { MUNICIPALITY_LOGO } from '../../constants/branding';
import { resolveMunicipalityLogoSrc } from '../../utils/assetUrl';

type MunicipalityLogoProps = {
  logoUrl?: string | null;
  alt: string;
  boxProps?: BoxProps;
};

/** Logotipo municipal com fallback automático se a imagem remota falhar. */
export function MunicipalityLogo({ logoUrl, alt, boxProps }: MunicipalityLogoProps) {
  const [src, setSrc] = useState(() => resolveMunicipalityLogoSrc(logoUrl));

  useEffect(() => {
    setSrc(resolveMunicipalityLogoSrc(logoUrl));
  }, [logoUrl]);

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      onError={() => {
        if (src !== MUNICIPALITY_LOGO) setSrc(MUNICIPALITY_LOGO);
      }}
      {...boxProps}
    />
  );
}
