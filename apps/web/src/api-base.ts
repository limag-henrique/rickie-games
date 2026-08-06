type ApiBaseOptions={apiUrl?:string;isDevelopment:boolean};

export function getApiBaseUrl({apiUrl,isDevelopment}:ApiBaseOptions):string {
  const configured=apiUrl?.trim().replace(/\/+$/g, "");
  if (configured) return configured;
  return isDevelopment ? "http://localhost:3001" : "";
}
