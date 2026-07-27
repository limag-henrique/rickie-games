import { contentPackSchema } from "@rickie/content-schema";

/** Conteúdo próprio: não é transcrição, adaptação ou identidade de jogos de terceiros. */
export const demoPack=contentPackSchema.parse({
  schemaVersion:"1.0",
  partner:{id:"rickie-studio",name:"Rickie Studio"},
  game:{id:"roda-de-caos",title:"Roda de Caos — Demo Original",engine:"QUESTION_VOTING",contentRating:"18+"},
  pack:{id:"caos-social-ptbr",version:"0.2.0",locale:"pt-BR",rightsStatus:"DEMO_ORIGINAL",region:["BR"],active:true},
  cards:[
    {id:"caos-001",type:"PLAYER_VOTE",prompt:"Quem chegaria a uma festa com 40 minutos de atraso e uma explicação ainda mais atrasada?",selfVoteAllowed:false,tags:["social","satira"]},
    {id:"caos-002",type:"PLAYER_VOTE",prompt:"Quem tem mais chance de transformar um detalhe mínimo em uma apresentação de 12 slides?",selfVoteAllowed:false,tags:["social","satira"]},
    {id:"caos-003",type:"PLAYER_VOTE",prompt:"Quem responderia “tô saindo” ainda de toalha, sem nenhum constrangimento?",selfVoteAllowed:false,tags:["humor","leve"]},
    {id:"caos-004",type:"PLAYER_VOTE",prompt:"Quem seria contratado para apagar um incêndio e terminaria criando um grupo para discutir o incêndio?",selfVoteAllowed:false,tags:["satira","caos"]},
    {id:"caos-005",type:"PLAYER_VOTE",prompt:"Quem defenderia uma opinião absurda com tanta confiança que quase convenceria a própria mesa?",selfVoteAllowed:false,tags:["satira","debate"]},
    {id:"caos-006",type:"PLAYER_VOTE",prompt:"Quem é mais provável de perder o próprio celular enquanto segura o próprio celular?",selfVoteAllowed:false,tags:["humor","social"]},
    {id:"caos-007",type:"PLAYER_VOTE",prompt:"Quem faria uma compra impulsiva às 2h e só perceberia a gravidade quando a entrega tocasse a campainha?",selfVoteAllowed:false,tags:["caos","satira"]},
    {id:"caos-008",type:"PLAYER_VOTE",prompt:"Quem conseguiria iniciar uma fofoca sobre si mesmo sem perceber?",selfVoteAllowed:false,tags:["humor","social"]},
    {id:"caos-009",type:"PLAYER_VOTE",prompt:"Quem seria o primeiro a sobreviver a um apocalipse só por não ter entendido que ele começou?",selfVoteAllowed:false,tags:["ficcao","satira"]},
    {id:"caos-010",type:"PLAYER_VOTE",prompt:"Quem transformaria uma brincadeira simples em uma disputa com regulamento, tabela e recurso?",selfVoteAllowed:false,tags:["competitivo","satira"]},
    {id:"caos-011",type:"PLAYER_VOTE",prompt:"Quem tem mais energia de “eu consigo explicar” e menos energia de realmente explicar?",selfVoteAllowed:false,tags:["satira","social"]},
    {id:"caos-012",type:"PLAYER_VOTE",prompt:"Quem aceitaria um desafio claramente ruim só porque alguém disse “covarde”?",selfVoteAllowed:false,tags:["desafio","humor"]},
    {id:"caos-013",type:"PLAYER_VOTE",prompt:"Quem sumiria da conversa por três dias e voltaria com “gente, o que perdi?”?",selfVoteAllowed:false,tags:["social","satira"]},
    {id:"caos-014",type:"PLAYER_VOTE",prompt:"Quem seria mais perigoso com acesso ao microfone numa festa?",selfVoteAllowed:false,tags:["festa","humor"]},
    {id:"caos-015",type:"PLAYER_VOTE",prompt:"Quem juraria que sabe cozinhar e colocaria fogo na água?",selfVoteAllowed:false,tags:["humor","caos"]},
    {id:"caos-016",type:"PLAYER_VOTE",prompt:"Quem conseguiria discutir com o GPS e perder para o GPS?",selfVoteAllowed:false,tags:["satira","social"]},
    {id:"caos-017",type:"PLAYER_VOTE",prompt:"Quem parece ter um plano genial até abrir a boca para explicá-lo?",selfVoteAllowed:false,tags:["satira","leve"]},
    {id:"caos-018",type:"PLAYER_VOTE",prompt:"Quem adotaria uma teoria completamente sem prova só porque ela renderia uma boa história?",selfVoteAllowed:false,tags:["ficcao","satira"]},
    {id:"caos-019",type:"PLAYER_VOTE",prompt:"Quem mais provavelmente criaria uma planilha para dividir uma conta de R$ 18,70?",selfVoteAllowed:false,tags:["social","satira"]},
    {id:"caos-020",type:"PLAYER_VOTE",prompt:"Quem teria maior chance de ser cancelado por uma mensagem enviada no grupo errado?",selfVoteAllowed:false,tags:["social","caos"]},
    {id:"caos-021",type:"PLAYER_VOTE",prompt:"Quem faria amizade com um desconhecido em cinco minutos e esqueceria o nome em quatro?",selfVoteAllowed:false,tags:["festa","humor"]},
    {id:"caos-022",type:"PLAYER_VOTE",prompt:"Quem defenderia que dormir cedo é importante e desapareceria às 4h da manhã?",selfVoteAllowed:false,tags:["festa","satira"]},
    {id:"caos-023",type:"PLAYER_VOTE",prompt:"Quem tem mais chance de ganhar um reality show por puro acaso e uma edição muito favorável?",selfVoteAllowed:false,tags:["ficcao","humor"]},
    {id:"caos-024",type:"PLAYER_VOTE",prompt:"Quem se voluntariaria para organizar a noite e imediatamente perderia o controle da noite?",selfVoteAllowed:false,tags:["festa","caos"]},
    {id:"caos-025",type:"PLAYER_VOTE",prompt:"Quem seria mais convincente vendendo uma ideia que acabou de inventar?",selfVoteAllowed:false,tags:["satira","social"]},
    {id:"caos-026",type:"PLAYER_VOTE",prompt:"Quem faria uma entrada dramática mesmo chegando só para buscar o carregador?",selfVoteAllowed:false,tags:["humor","festa"]},
    {id:"caos-027",type:"PLAYER_VOTE",prompt:"Quem consegue ter a certeza de estar certo e ainda assim consultar cinco pessoas?",selfVoteAllowed:false,tags:["satira","debate"]},
    {id:"caos-028",type:"PLAYER_VOTE",prompt:"Quem acabaria eleito líder de uma missão só porque ninguém mais queria ler as instruções?",selfVoteAllowed:false,tags:["ficcao","social"]},
    {id:"caos-029",type:"PLAYER_VOTE",prompt:"Quem apareceria com uma ideia de negócio tão ruim que, estranhamente, quase parece boa?",selfVoteAllowed:false,tags:["satira","caos"]},
    {id:"caos-030",type:"PLAYER_VOTE",prompt:"Quem deixaria a conversa mais interessante e mais confusa ao mesmo tempo?",selfVoteAllowed:false,tags:["social","humor"]}
  ]
});
