import type { ReactNode } from 'react';
import { Alert, Box, Button, Paper, Typography } from '@mui/material';
import { Download, Info } from '@mui/icons-material';
import {
  LEGACY_DOWNLOAD_FILENAME,
  LEGACY_DOWNLOAD_PATH,
  legacyDownloadShareUrl,
} from '../../constants/delivery';

/** Bloco com título e lista, no mesmo estilo de cartão das outras seções. */
function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, mb: 2 }}>
      <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
        {titulo}
      </Typography>
      {children}
    </Paper>
  );
}

const listaSx = { m: 0, pl: 2.5, '& li': { mb: 1 }, '& li:last-of-type': { mb: 0 } } as const;

/**
 * Página /ajuda: como o SIGAPS funciona hoje (endereço, internet, celular,
 * backups) e o pacote ZIP da entrega. O endereço vem da própria página
 * (window.location.origin), porque o domínio ainda vai mudar.
 */
export function AjudaPage() {
  const enderecoAtual = window.location.origin;

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" component="h1" sx={{ mb: 1 }}>
        Ajuda
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Como o SIGAPS funciona hoje e o que saber no dia a dia.
      </Typography>

      <Secao titulo="Acesso">
        <Box component="ul" sx={listaSx}>
          <li>
            <strong>Endereço:</strong>{' '}
            <Box component="span" sx={{ wordBreak: 'break-all' }}>
              {enderecoAtual}
            </Box>
            . Ele pode mudar quando a prefeitura tiver um domínio próprio; a coordenação informa o
            novo endereço.
          </li>
          <li>
            <strong>Abre a qualquer hora:</strong> o sistema fica na nuvem e responde em poucos
            segundos. Depois de um tempo sem uso, o primeiro carregamento pode levar alguns
            segundos a mais.
          </li>
          <li>
            <strong>No celular:</strong> dá para instalar o SIGAPS na tela inicial, como um
            aplicativo. Quando o navegador oferecer, toque em <em>Instalar</em> (ou use{' '}
            <em>Adicionar à tela inicial</em> no menu do navegador).
          </li>
        </Box>
      </Secao>

      <Secao titulo="Internet">
        <Box component="ul" sx={listaSx}>
          <li>
            Entrar, abrir o mapa e pintar ruas precisam de internet (Wi-Fi ou dados móveis).
          </li>
          <li>
            Com sinal fraco, as telas podem demorar. Se o pedido falhar, o sistema tenta de novo
            sozinho algumas vezes antes de mostrar o erro, e aí é só tocar em{' '}
            <em>Tentar novamente</em>.
          </li>
          <li>
            Se o aparelho estiver sem internet, o aviso diz isso. Se a internet estiver ligada e o
            erro continuar, o problema é do servidor: espere um pouco e tente de novo.
          </li>
        </Box>
      </Secao>

      <Secao titulo="Seus dados">
        <Box component="ul" sx={listaSx}>
          <li>
            Cada pintura e cadastro é salvo na hora no banco de dados, e fica registrado quem fez
            cada alteração.
          </li>
          <li>
            Toda semana sai um backup automático, guardado em armazenamento privado. O
            administrador também pode gerar e baixar um backup em <em>Administração</em>.
          </li>
        </Box>
      </Secao>

      <Secao titulo="Pacote ZIP para o Jonas">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Código-fonte legado da entrega (backend, frontend, documentação). O Jonas pinta o mapa pelo
          site — o ZIP é para arquivo, auditoria ou outro desenvolvedor.
        </Typography>
        <Button
          variant="contained"
          color="success"
          startIcon={<Download />}
          component="a"
          href={LEGACY_DOWNLOAD_PATH}
          target="_blank"
          rel="noopener noreferrer"
          download={LEGACY_DOWNLOAD_FILENAME}
          sx={{ fontWeight: 700, mb: 1, maxWidth: '100%', whiteSpace: 'normal', textAlign: 'left' }}
        >
          Baixar {LEGACY_DOWNLOAD_FILENAME}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-all' }}>
          Link: {legacyDownloadShareUrl()}
        </Typography>
      </Secao>

      <Alert icon={<Info />} severity="info">
        Dúvidas sobre microáreas, ruas ou acesso: fale com a coordenação da APS da sua UBS.
      </Alert>
    </Box>
  );
}
