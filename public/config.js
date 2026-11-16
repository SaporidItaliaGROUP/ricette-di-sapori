// Collegamento ad Appwrite. Niente di segreto qui dentro.
// Finché «projectId» è vuoto il programma lavora in MODALITÀ PROVA:
// i dati restano solo nel browser di questo dispositivo.
window.RICETTE_CONFIG = {
  endpoint: "https://fra.cloud.appwrite.io/v1",
  projectId: "6afaec92001e6fb9cc6e",
  databaseId: "ricette",
  collectionId: "ricette",
  bucketId: "foto",
  teamId: "redazione",
  fnLink: "importa-link",
  fnFoto: "leggi-foto",
};
