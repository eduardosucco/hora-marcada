# Configuração pendente — Hora Marcada

O site roda em demonstração até SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY serem configurados no ambiente do Sites. Nenhuma chave privilegiada é necessária no frontend.

1. Confirmar organização e custo, criar projeto novo na região sa-east-1.
2. Aplicar schema.sql como uma migration via ferramenta Supabase; executar advisors de segurança e testar RLS com dois prestadores e dois clientes.
3. Configurar as duas variáveis do Sites com URL e publishable key do projeto.
4. Habilitar confirmação de e-mail e configurar SMTP e Site URL/redirecionamentos para a URL publicada.
5. Habilitar Phone Auth e um provedor de SMS no Supabase. O frontend usa SMS no número de WhatsApp do cliente; não envia mensagens WhatsApp. Não basta informar um telefone para obter acesso.
6. Testar signup, confirmação de e-mail, login, expiração/renovação de sessão, OTP real, agendamento concorrente e isolamento de dados.

Horários iniciais: todos os dias, 08h–18h, America/Sao_Paulo, início a cada 30 minutos. Um atendimento por prestador. Pagamento manual integral por atendimento; sem gateway ou armazenamento de cartão. Horário e preço são congelados pelo banco na criação. Serviços podem ser pausados. Reservas finalizadas são imutáveis. Cancelar e reservar novamente permite alterar horário.

Dados demonstrativos ficam exclusivamente em localStorage hm-demo-v1. Entrar numa conta real substitui os dados demonstrativos pelos resultados RLS do banco. Nenhum dado de demonstração é enviado ao Supabase.

## White-label
A coluna hm_providers.brand armazena nome, frase, segmento e cores por prestador. As políticas existentes protegem a edição pelo proprietário, permitindo leitura da marca aos clientes autenticados. O frontend usa a marca do prestador selecionado em ambas as áreas. Demonstração persiste no objeto provider do localStorage. Preferência light/dark/system é individual e fica em hm-appearance. O esquema ainda não foi aplicado a um projeto real. Domínios próprios, planos comerciais, cobrança de assinaturas e administração de revendedores não fazem parte desta entrega.
