# Manual de Entrega SIGAPS

Documentação oficial do sistema para homologação e aceite do cliente.

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `MANUAL_ENTREGA.md` | Fonte do manual (Markdown + HTML para capa) |
| `SIGAPS_Manual_Entrega_Oficial.pdf` | **PDF final** para impressão e assinatura |
| `screenshots/` | Capturas em alta resolução (1920×1080, escala 2×) |

## Regenerar o PDF

```bash
# Capturar telas da produção + gerar PDF
npm run docs:manual

# Só gerar PDF (se as telas já existirem)
npm run docs:manual:pdf
```

Variáveis opcionais: `SIGAPS_URL`, `SIGAPS_EMAIL`, `SIGAPS_PASS`.

## Assinaturas

O PDF inclui página de termo de aceite com espaços para:

- **Jonas Almeida Medeiros** — Cliente / Enfermeiro APS (assinatura gov.br)
- **Yuri Medeiros Bandeira** — Desenvolvedor
