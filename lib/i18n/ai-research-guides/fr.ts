import type {
  AiResearchGuidesContent,
  SeoLandingPageContentI18n,
  SeoLandingPageUi,
} from "@/lib/i18n/ai-research-guides/types";

const SHARED_FEATURES = [
  {
    title: "Citations fondées sur les sources",
    body: "Les réponses renvoient aux instruments de la bibliothèque afin que vous puissiez consulter le texte législatif sous-jacent et vérifier la réponse.",
  },
  {
    title: "Bibliothèque juridique couvrant 54 pays",
    body: "La recherche s'appuie sur une bibliothèque juridique africaine en expansion — consultable par pays, thème et statut.",
  },
  {
    title: "Cadres régionaux",
    body: "La ZLECAf, l'OHADA, la CEDEAO et d'autres textes supranationaux sont pris en compte lorsqu'ils figurent dans les extraits récupérés.",
  },
  {
    title: "Conçu pour les praticiens",
    body: "Pensé pour les cabinets d'avocats, les équipes commerciales et les étudiants qui ont besoin d'une orientation rapide — avec des voies vers un conseil humain via l'annuaire des avocats.",
  },
] as const;

const SHARED_FAQS = [
  {
    question: "Qu'est-ce que la recherche juridique par IA en Afrique ?",
    answer:
      "La recherche juridique par IA en Afrique utilise l'intelligence artificielle pour vous aider à trouver et à interpréter les règles juridiques dans les juridictions africaines. Yamalé privilégie des réponses fondées sur les sources primaires de sa bibliothèque juridique — lois et règlements — plutôt que sur du texte web générique sans citation.",
  },
  {
    question: "En quoi Yamalé diffère-t-il de ChatGPT pour le droit africain ?",
    answer:
      "Les modèles d'IA généralistes peuvent inventer ou mal appliquer des règles. Yamalé récupère des extraits de sa bibliothèque juridique africaine et demande au modèle de répondre uniquement à partir de ces textes, avec des citations vers les instruments utilisés. Il s'agit d'un assistant de recherche sur votre bibliothèque, et non d'un substitut au jugement professionnel.",
  },
  {
    question: "Quels pays et quels thèmes Yamalé couvre-t-il ?",
    answer:
      "La bibliothèque vise une couverture étendue des pays africains, avec une profondeur variable selon la juridiction et le thème. Les États membres de l'OHADA, les instruments de la ZLECAf et les principales catégories commerciales, du travail et du commerce font l'objet d'un enrichissement actif. Consultez la bibliothèque ou posez une question spécifique à un pays pour voir ce qui est disponible aujourd'hui.",
  },
  {
    question: "Yamalé remplace-t-il un avocat ?",
    answer:
      "Non. Yamalé accélère la recherche et vous aide à localiser les instruments pertinents. Il ne fournit pas de conseil juridique. Pour les dossiers nécessitant une représentation ou des avis formels, utilisez l'annuaire des avocats commerciaux ou votre propre conseil.",
  },
  {
    question: "Comment commencer à utiliser la recherche juridique par IA sur Yamalé ?",
    answer:
      "Ouvrez Recherche IA, connectez-vous et posez une question qui indique le pays et le thème — par exemple le droit du travail au Mozambique ou l'immatriculation d'une société au Ghana. Les formules incluant des requêtes IA sont listées sur la page tarifs.",
  },
] as const;

export const FR_AI_RESEARCH_GUIDES: AiResearchGuidesContent = {
  eyebrow: "Recherche juridique IA Yamalé",
  h1: "Recherche juridique par IA en Afrique — des réponses fondées sur les sources primaires",
  heroSubtitleSignedOut:
    "Connectez-vous pour vous abonner ou acheter une requête IA à l'unité. Les formules incluent des crédits mensuels de recherche juridique par IA fondés sur la bibliothèque juridique africaine Yamalé.",
  whatYouGet: "Ce que vous obtenez",
  faqTitle: "Questions fréquentes",
  exploreGuides: "Explorer les guides",
  exploreGuidesAria: "Guides de recherche IA",
  intro: [
    "Yamalé est une plateforme de recherche juridique par IA conçue pour l'Afrique. Posez vos questions en langage courant et recevez des réponses tirées des lois, règlements et instruments régionaux de la Bibliothèque juridique Yamalé — et non de résumés web génériques.",
    "Contrairement aux chatbots à usage général, la recherche juridique IA de Yamalé cite les textes de la bibliothèque qu'elle utilise. Cela compte pour les avocats, les juristes d'entreprise, les équipes conformité et les étudiants en droit qui doivent savoir quel instrument soutient une réponse avant de s'y fier dans un avis, un dossier ou un examen.",
    "La couverture englobe le droit national dans les juridictions africaines, le droit des affaires OHADA, les règles commerciales de la ZLECAf et d'autres cadres régionaux lorsqu'ils figurent dans la bibliothèque. Lorsqu'une loi nationale n'est pas encore dans le corpus, l'assistant doit le signaler — et ne pas substituer le droit national d'un autre pays.",
  ],
  features: [...SHARED_FEATURES],
  faqs: [...SHARED_FAQS],
  relatedLinks: [
    { href: "/ai-legal-search-africa", label: "Recherche juridique par IA en Afrique" },
    { href: "/ohada-ai-legal-research", label: "Recherche juridique IA OHADA" },
    { href: "/afcfta-ai-legal-research", label: "Recherche juridique IA ZLECAf" },
    { href: "/african-legal-library-ai", label: "Bibliothèque juridique africaine avec IA" },
    { href: "/library", label: "Parcourir la bibliothèque juridique" },
    { href: "/pricing", label: "Voir les formules" },
  ],
};

export const FR_SEO_PAGE_UI: SeoLandingPageUi = {
  backToPlatform: "Plateforme juridique Yamalé",
  tryAiResearch: "Essayer la recherche IA",
  browseLibrary: "Parcourir la bibliothèque",
  whyTeams: "Pourquoi les équipes utilisent Yamalé",
  faqTitle: "Questions fréquentes",
  related: "Liens connexes",
  relatedAria: "Pages connexes",
  viewPricing: "Voir les tarifs",
  contactUs: "Nous contacter",
};

export const FR_SEO_LANDING_PAGES: Record<string, SeoLandingPageContentI18n> = {
  aiLegalSearchAfrica: {
    metaTitle: "Recherche juridique par IA en Afrique — recherche fondée sur les sources | Yamalé",
    metaDescription:
      "Recherche juridique par IA en Afrique fondée sur les lois et règlements. Yamalé cite les sources primaires africaines de sa bibliothèque juridique — pour avocats, équipes et étudiants.",
    keywords: [
      "recherche juridique IA Afrique",
      "recherche juridique IA en Afrique",
      "IA juridique africaine",
      "recherche juridique Afrique IA",
    ],
    eyebrow: "Recherche juridique IA · Afrique",
    h1: "Recherche juridique par IA en Afrique — fondée sur les lois, pas sur des suppositions",
    intro: [
      "Rechercher le droit africain ne devrait pas signifier faire défiler des PDF à l'infini ou faire confiance à un chatbot sans sources. Yamalé combine la recherche juridique par IA avec une bibliothèque juridique africaine dédiée afin que les réponses puissent renvoyer aux instruments sur lesquels elles s'appuient.",
      "Que vous travailliez sur le commerce transfrontalier, la conformité locale ou les études universitaires, vous pouvez poser des questions en langage naturel et examiner les lois et règlements cités. La plateforme est conçue en Afrique et pensée pour la manière dont les règles continentales et nationales s'articulent réellement — droit interne, communautés économiques régionales, OHADA et ZLECAf.",
      "Commencez par un pays et un thème précis pour de meilleurs résultats. Yamalé enrichit continuellement le corpus ; lorsqu'un texte n'est pas dans la bibliothèque, l'assistant de recherche doit reconnaître cette lacune au lieu de substituer le droit d'un autre pays.",
    ],
    features: [...SHARED_FEATURES],
    faqs: [...SHARED_FAQS],
    relatedLinks: [
      { href: "/ai-research", label: "Ouvrir la recherche IA" },
      { href: "/library", label: "Bibliothèque juridique africaine" },
      { href: "/ohada-ai-legal-research", label: "Recherche IA OHADA" },
      { href: "/afcfta-ai-legal-research", label: "Recherche IA ZLECAf" },
    ],
  },
  ohada: {
    metaTitle: "Recherche juridique IA OHADA — actes uniformes et droit des affaires | Yamalé",
    metaDescription:
      "Recherchez les actes uniformes OHADA et le droit des affaires avec une IA fondée sur les textes de la bibliothèque. Droit des sociétés, droit commercial et instruments OHADA avec citations.",
    keywords: [
      "recherche juridique IA OHADA",
      "droit OHADA IA",
      "recherche actes uniformes OHADA",
      "droit des affaires OHADA",
    ],
    eyebrow: "OHADA · recherche juridique IA",
    h1: "Recherche juridique IA OHADA sur les sources primaires",
    intro: [
      "L'OHADA harmonise le droit des affaires entre les États membres. Yamalé vous aide à rechercher et à interpréter les actes uniformes OHADA et les instruments connexes grâce à une IA limitée aux extraits de la bibliothèque — afin que vous puissiez retracer les réponses jusqu'à l'acte lui-même.",
      "Utilisez la recherche juridique IA OHADA pour la création de sociétés, les contrats commerciaux, l'arbitrage et les opérations transfrontalières dans l'espace OHADA. Combinez les requêtes IA avec la consultation directe de la bibliothèque lorsque vous avez besoin du texte intégral d'un acte ou d'un article.",
      "Pour les règles nationales qui coexistent avec les textes OHADA, indiquez l'État membre dans votre question. Les instruments régionaux et le droit national d'application sont traités différemment ; Yamalé privilégie les instruments effectivement récupérés pour votre requête.",
    ],
    features: [
      {
        title: "Actes uniformes dans la bibliothèque",
        body: "Recherchez le droit des sociétés OHADA, le droit commercial et les textes connexes aux côtés de la législation nationale d'application lorsqu'elle est disponible.",
      },
      {
        title: "Réponses citées",
        body: "Les réponses de l'IA renvoient aux documents de la bibliothèque afin que vous puissiez vérifier les articles et définitions en contexte.",
      },
      {
        title: "Flux de travail du praticien",
        body: "Passez du résumé IA au texte intégral de l'instrument dans la bibliothèque sans quitter la plateforme.",
      },
      {
        title: "Usage francophone et anglophone",
        body: "Posez vos questions dans la langue de travail ; concentrez-vous sur la question juridique et la juridiction pour une meilleure récupération.",
      },
    ],
    faqs: [
      {
        question: "Yamalé peut-il répondre aux questions de droit des sociétés OHADA ?",
        answer:
          "Oui, lorsque les actes uniformes OHADA pertinents et les extraits correspondants figurent dans la bibliothèque. Posez une question précise — par exemple les devoirs des administrateurs en droit des sociétés OHADA — et examinez les instruments cités dans la réponse.",
      },
      {
        question: "La recherche IA OHADA remplace-t-elle la lecture de l'acte uniforme ?",
        answer:
          "Non. La recherche IA vous aide à localiser et à vous orienter plus rapidement dans les textes OHADA. Lisez toujours les dispositions citées et confirmez les mises à jour ou variations nationales avant de conseiller vos clients.",
      },
      {
        question: "Quels pays OHADA sont pris en charge ?",
        answer:
          "Les États membres de l'OHADA partagent des actes uniformes ; les mesures nationales d'application peuvent différer. Indiquez le pays dans votre requête lorsque vous avez besoin du contexte national aux côtés des règles OHADA.",
      },
      {
        question: "Comment essayer la recherche juridique IA OHADA ?",
        answer:
          "Connectez-vous à la recherche IA sur Yamalé et posez une question axée sur l'OHADA, ou parcourez d'abord les instruments OHADA dans la bibliothèque.",
      },
    ],
    relatedLinks: [
      { href: "/ai-research", label: "Ouvrir la recherche IA" },
      { href: "/library", label: "Parcourir les textes OHADA" },
      { href: "/ai-legal-search-africa", label: "Recherche juridique par IA en Afrique" },
    ],
  },
  afcfta: {
    metaTitle: "Recherche juridique IA ZLECAf — règles commerciales et conformité | Yamalé",
    metaDescription:
      "Recherche juridique par IA pour les règles d'origine ZLECAf, les barèmes tarifaires et la conformité commerciale — fondée sur les sources de la bibliothèque Yamalé avec citations.",
    keywords: [
      "recherche juridique IA ZLECAf",
      "conformité ZLECAf IA",
      "règles d'origine ZLECAf",
      "droit commercial africain IA",
    ],
    eyebrow: "ZLECAf · recherche juridique IA",
    h1: "Recherche juridique IA ZLECAf pour les équipes commerce et conformité",
    intro: [
      "La Zone de libre-échange continentale africaine transforme la manière dont les entreprises abordent les règles d'origine, les tarifs et l'accès aux marchés. Yamalé prend en charge la recherche juridique IA ZLECAf à partir des instruments commerciaux et des textes connexes de la bibliothèque.",
      "Les responsables conformité et les avocats en droit commercial peuvent poser des questions ciblées — certificats d'origine, éligibilité des produits, calendriers de réduction tarifaire — et recevoir des réponses liées aux sources ZLECAf et connexes récupérées. Utilisez les outils ZLECAf dédiés de la plateforme pour des flux de conformité structurés en complément de la recherche IA.",
      "Associez les requêtes IA aux outils de vérification de conformité et de barème tarifaire lorsque vous avez besoin de flux interactifs, et non seulement de réponses narratives.",
    ],
    features: [
      {
        title: "Récupération axée sur le commerce",
        body: "Les questions sur les instruments ZLECAf s'appuient sur les textes de la bibliothèque plutôt que sur des données d'entraînement génériques.",
      },
      {
        title: "Outils de conformité",
        body: "Utilisez la vérification de conformité ZLECAf et les outils de parcours commerciaux conjointement avec la recherche IA pour des flux de bout en bout.",
      },
      {
        title: "Contexte transfrontalier",
        body: "Formulez vos questions en précisant le produit, le corridor et les États membres pour une récupération plus précise.",
      },
      {
        title: "Résultats citables",
        body: "Examinez quels instruments le modèle a utilisés avant de vous fier à une réponse dans un dossier ou un avis client.",
      },
    ],
    faqs: [
      {
        question: "Yamalé peut-il aider avec les règles d'origine ZLECAf ?",
        answer:
          "Yamalé peut vous orienter dans les règles ZLECAf lorsque les textes pertinents figurent dans la bibliothèque. Posez une question précise sur le produit et le corridor, puis vérifiez les citations par rapport aux instruments officiels.",
      },
      {
        question: "Existe-t-il un outil de conformité ZLECAf distinct ?",
        answer:
          "Oui. Yamalé propose une vérification de conformité ZLECAf et des outils connexes en plus de la recherche juridique IA. Utilisez les deux lorsque vous avez besoin de contrôles structurés et de questions-réponses libres.",
      },
      {
        question: "À qui s'adresse la recherche IA ZLECAf ?",
        answer:
          "Aux exportateurs, importateurs, équipes commerce internes, conseillers en douane et avocats conseillant sur l'accès aux marchés africains.",
      },
    ],
    relatedLinks: [
      { href: "/ai-research", label: "Ouvrir la recherche IA" },
      { href: "/afcfta/compliance-check", label: "Vérification de conformité ZLECAf" },
      { href: "/afcfta/tariff-schedule", label: "Outil de barème tarifaire" },
      { href: "/ai-legal-search-africa", label: "Recherche juridique par IA en Afrique" },
    ],
  },
  africanLegalLibraryAi: {
    metaTitle: "Bibliothèque juridique africaine avec IA — rechercher les lois par pays | Yamalé",
    metaDescription:
      "Parcourez et recherchez les lois africaines dans 54 pays, puis lancez une recherche juridique par IA sur les mêmes sources primaires. Une plateforme pour la bibliothèque et les réponses IA citées.",
    keywords: [
      "bibliothèque juridique africaine IA",
      "base de données droit africain",
      "rechercher lois africaines",
      "bibliothèque juridique Afrique",
    ],
    eyebrow: "Bibliothèque juridique · recherche IA",
    h1: "Bibliothèque juridique africaine avec IA — rechercher, lire et interroger",
    intro: [
      "Yamalé associe une bibliothèque juridique africaine consultable à une recherche juridique par IA sur le même corpus. Parcourez les lois par pays et par catégorie, ouvrez les textes intégraux, puis posez des questions de suivi dans la recherche IA avec des citations vers les instruments sur lesquels vous travaillez.",
      "Pour les étudiants en droit, le flux de travail soutient la préparation aux examens et les travaux universitaires : trouvez la loi, lisez les articles, puis testez votre compréhension avec des questions-réponses citées. Pour les cabinets et les équipes internes, il réduit le temps passé à chercher des PDF dans plusieurs juridictions.",
      "La bibliothèque est la source de vérité. L'IA est une couche par-dessus — utile pour l'orientation et l'identification des enjeux, et non un substitut à la lecture des sources primaires ou à un conseil professionnel.",
    ],
    features: [
      {
        title: "Corpus unifié",
        body: "La recherche IA et la consultation de la bibliothèque s'appuient sur la même collection croissante de textes juridiques africains.",
      },
      {
        title: "Filtrer par juridiction",
        body: "Affinez par pays, catégorie et statut avant de rechercher ou de poser des questions à l'IA.",
      },
      {
        title: "De la citation au texte intégral",
        body: "Ouvrez les lois citées directement depuis les fiches sources de la recherche IA lorsque vous avez besoin de l'instrument complet.",
      },
      {
        title: "Coffre-fort et conseil",
        body: "Combinez le travail sur la bibliothèque et l'IA avec les modèles du Coffre-fort Yamalé et l'annuaire des avocats.",
      },
    ],
    faqs: [
      {
        question: "Combien de pays la bibliothèque juridique Yamalé couvre-t-elle ?",
        answer:
          "La plateforme est conçue pour une couverture étendue de l'Afrique dans 54 pays, avec une profondeur variable selon la juridiction et le thème. Utilisez les filtres de la bibliothèque pour voir ce qui est disponible aujourd'hui pour un pays donné.",
      },
      {
        question: "Puis-je utiliser la bibliothèque sans l'IA ?",
        answer:
          "Oui. La consultation de la bibliothèque est disponible avec les formules gratuites et payantes. La recherche IA nécessite une formule incluant des requêtes IA.",
      },
      {
        question: "L'IA recherche-t-elle sur tout Internet ?",
        answer:
          "Non. La recherche juridique IA de Yamalé est conçue pour répondre à partir d'extraits de la bibliothèque (plus des compléments web limités optionnels pour l'orientation), et non à partir du web ouvert en tant que droit contraignant.",
      },
    ],
    relatedLinks: [
      { href: "/library", label: "Ouvrir la bibliothèque juridique" },
      { href: "/ai-research", label: "Recherche juridique IA" },
      { href: "/ai-legal-search-africa", label: "Recherche juridique par IA en Afrique" },
      { href: "/pricing", label: "Formules et tarifs" },
    ],
  },
};
