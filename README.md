# Atlas interativo de Icewind Dale

Aplicação web da etapa 17 de **Mão Cinzenta: Os Tratados de Sangue e Cinzas**. O projeto oferece o mesmo mapa em duas experiências:

- `/`: visão pública, somente com pontos revelados pelo Mestre;
- `/<SLUG_SECRETO>`: editor do Mestre, sem login, acessado por uma URL longa e não óbvia.

O mapa usa a imagem estática original, Leaflet com `CRS.Simple` e coordenadas normalizadas entre `0` e `1`. Isso mantém os pontos alinhados em qualquer tamanho de tela.

## O que já está incluído

- Zoom, arraste, controles visuais e gestos de toque.
- Pontos circulares coloridos com o nome abaixo, sem pinos tradicionais.
- Popup controlado pelo React com descrição, imagem e estado de missão.
- Filtros por categoria na visão pública.
- Editor para criar, editar, arrastar, revelar, ocultar e excluir pontos.
- Atualização pública automática a cada 45 segundos.
- API serverless que nunca devolve pontos ocultos na consulta pública.
- Banco Supabase protegido por RLS, acessado somente com a chave privada no servidor.
- Os 22 pontos visuais da imagem-base já preparados na migração: dez assentamentos, quatro pontos azuis, um laranja, um vermelho sem nome e seis brancos.

Os sete pontos sem nome começam ocultos e sem descrição. Eles aparecem no painel do Mestre para serem preparados depois, sem conteúdo narrativo inventado.

## Requisitos

- Node.js 20 ou superior.
- Uma conta na [Supabase](https://supabase.com/).
- Uma conta na [Vercel](https://vercel.com/) para publicação.

## 1. Instalar as dependências

```powershell
npm install
```

## 2. Configurar o Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor** no painel do projeto.
3. Copie e execute todo o arquivo `supabase/migration.sql`.
4. Em **Project Settings → API**, copie:
   - a URL do projeto;
   - a chave privada `service_role` ou `secret`.

A chave privada é secreta. Não a coloque em arquivos versionados e nunca use uma variável iniciada por `VITE_` para armazená-la.

## 3. Configurar o ambiente local

Crie `.env.local` a partir do exemplo:

```powershell
Copy-Item .env.example .env.local
```

Preencha:

```dotenv
ICEWIND_DB_URL=https://seu-projeto.supabase.co
ICEWIND_DB_SECRET_KEY=sua-chave-privada-do-supabase
MASTER_SLUG=uma-sequencia-longa-aleatoria-e-dificil-de-adivinhar
```

Os nomes `ICEWIND_DB_URL` e `ICEWIND_DB_SECRET_KEY` são próprios desta aplicação.
A API não lê `SUPABASE_URL`, `SUPABASE_SECRET_KEY` nem outras variáveis criadas
automaticamente pela integração da Vercel.

O slug deve conter somente o trecho depois da primeira barra. Não use `admin`, `senha` ou outro nome previsível.

## 4. Rodar localmente

Para executar frontend e funções serverless juntos:

```powershell
npm run dev
```

O comando inicia Vite e a mesma função de API usada na Vercel, carregando o arquivo `.env.local`. Abra:

- mapa público: `http://localhost:5173/`
- painel do Mestre: `http://localhost:5173/SEU_MASTER_SLUG`

Para trabalhar somente na interface, sem as funções da API:

```powershell
npm run dev:web
```

Nesse modo o mapa abre, mas a consulta e a gravação de pontos exibem erro de conexão, pois `/api/markers` não está sendo executado.

## Imagem-base

A imagem fornecida já está em:

```text
public/maps/icewind-dale.png
```

Ela possui 1219 × 838 pixels. É possível substituí-la no futuro por uma versão de resolução maior, desde que a nova imagem preserve exatamente a mesma proporção e geografia.

## Verificações

```powershell
npm test
npm run build
```

O teste automatizado confirma, entre outras validações, que registros ocultos são removidos de uma resposta pública. A API também aplica o filtro diretamente na consulta ao Supabase.

## Publicar na Vercel

### Opção A: importar um repositório Git

1. Coloque esta pasta em um repositório Git e envie para GitHub, GitLab ou Bitbucket.
2. No painel da Vercel, escolha **Add New → Project** e importe o repositório.
3. Confirme o framework **Vite**.
4. Configure as três variáveis em **Settings → Environment Variables**:
   - `ICEWIND_DB_URL`
   - `ICEWIND_DB_SECRET_KEY`
   - `MASTER_SLUG`
5. Faça o deploy.

### Opção B: Vercel CLI

```powershell
npx vercel
npx vercel --prod
```

Configure as mesmas três variáveis no painel antes do deploy de produção.

Depois da publicação, os endereços serão:

```text
https://SEU-DOMINIO.vercel.app/
https://SEU-DOMINIO.vercel.app/SEU_MASTER_SLUG
```

Alterações salvas no painel aparecem na página pública ao recarregar ou em até 45 segundos, sem novo deploy.

## Modelo de acesso

O projeto não possui contas, senha digitada, sessão ou OAuth. O trecho secreto da URL é enviado em um cabeçalho à função serverless e comparado com `MASTER_SLUG`. A interface pública não contém o valor configurado.

Esse modelo é deliberadamente simples e **não equivale a autenticação robusta**. O endereço privado pode aparecer no histórico do navegador, logs, capturas de tela ou ser compartilhado por engano. Quem possuir o endereço consegue editar o mapa.

Mesmo com essa limitação consciente:

- a chave privada do Supabase permanece somente nas funções serverless;
- o navegador não consulta a tabela diretamente;
- a rota pública seleciona apenas `is_visible = true` e filtra novamente a resposta antes de enviá-la.

## Estrutura principal

```text
api/markers.ts                 função serverless da Vercel
public/maps/icewind-dale.png   imagem-base
server/                        validação e verificação do slug
src/components/                mapa, popup, filtros e editor
supabase/migration.sql         tabela, RLS e os 22 pontos iniciais
```

