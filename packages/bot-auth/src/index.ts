import { ConfidentialClientApplication, Configuration } from '@azure/msal-node';

const config: Configuration = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || '',
    authority: process.env.AZURE_AUTHORITY || '',
    clientSecret: process.env.AZURE_CLIENT_SECRET || '',
  },
};

const cca = new ConfidentialClientApplication(config);

export async function authenticateWithAzureEntraID(username: string, password: string) {
  const result = await cca.acquireTokenByUsernamePassword({
    scopes: ['user.read'],
    username,
    password,
  });

  return result;
}
