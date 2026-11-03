import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Issuer, generators, type Client } from 'openid-client';

import { AppConfigService } from '../config/app-config.service';

export interface GoogleAuthorizationRequest {
  authorizationUrl: string;
  /**
   * Token opaco e de vida curta que carrega `state`, `nonce` e o
   * `code_verifier` do PKCE. O cliente devolve-o no callback, o que mantem o
   * fluxo sem estado no servidor sem abrir mao das protecoes do OIDC.
   */
  flowToken: string;
  expiresInSeconds: number;
}

export interface GoogleIdentity {
  subject: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  picture?: string;
}

interface FlowClaims {
  state: string;
  nonce: string;
  codeVerifier: string;
  purpose: 'google-oidc';
}

const FLOW_TTL_SECONDS = 600;

/**
 * Login com Google via OpenID Connect.
 *
 * Usa descoberta de metadados, `state` contra CSRF, `nonce` contra replay do
 * id_token e PKCE (S256). A verificacao da assinatura e das claims e feita pela
 * biblioteca contra o JWKS do proprio Google.
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private clientPromise: Promise<Client> | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly jwt: JwtService,
  ) {}

  get enabled(): boolean {
    return this.config.google.enabled;
  }

  private async getClient(): Promise<Client> {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Login com Google nao esta configurado nesta instalacao.',
      );
    }
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const issuer = await Issuer.discover(this.config.google.issuer);
        this.logger.log(`Provedor OIDC descoberto: ${issuer.issuer}`);
        return new issuer.Client({
          client_id: this.config.google.clientId as string,
          client_secret: this.config.google.clientSecret as string,
          redirect_uris: [this.config.google.redirectUri as string],
          response_types: ['code'],
        });
      })().catch((error) => {
        // Permite nova tentativa no proximo acesso, em vez de cachear a falha.
        this.clientPromise = null;
        throw error;
      });
    }
    return this.clientPromise;
  }

  async createAuthorizationRequest(): Promise<GoogleAuthorizationRequest> {
    const client = await this.getClient();

    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    const authorizationUrl = client.authorizationUrl({
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });

    const claims: FlowClaims = { state, nonce, codeVerifier, purpose: 'google-oidc' };
    const flowToken = await this.jwt.signAsync(claims, {
      secret: this.config.jwt.accessSecret,
      expiresIn: FLOW_TTL_SECONDS,
    });

    return { authorizationUrl, flowToken, expiresInSeconds: FLOW_TTL_SECONDS };
  }

  async exchange(code: string, state: string, flowToken: string): Promise<GoogleIdentity> {
    const client = await this.getClient();

    let claims: FlowClaims;
    try {
      claims = await this.jwt.verifyAsync<FlowClaims>(flowToken, {
        secret: this.config.jwt.accessSecret,
      });
    } catch {
      throw new BadRequestException('Fluxo de login expirado ou invalido. Tente novamente.');
    }

    if (claims.purpose !== 'google-oidc') {
      throw new BadRequestException('Token de fluxo invalido.');
    }
    if (claims.state !== state) {
      throw new BadRequestException('Parametro "state" nao corresponde ao fluxo iniciado.');
    }

    const tokenSet = await client.callback(
      this.config.google.redirectUri as string,
      { code, state },
      { state: claims.state, nonce: claims.nonce, code_verifier: claims.codeVerifier },
    );

    const idClaims = tokenSet.claims();
    const email = typeof idClaims.email === 'string' ? idClaims.email : undefined;

    if (!email) {
      throw new BadRequestException(
        'A conta Google nao forneceu um e-mail; nao e possivel criar a conta no LoneTale.',
      );
    }

    return {
      subject: idClaims.sub,
      email,
      emailVerified: idClaims.email_verified === true,
      displayName:
        (typeof idClaims.name === 'string' && idClaims.name) ||
        (typeof idClaims.given_name === 'string' && idClaims.given_name) ||
        email.split('@')[0] ||
        'Jogador',
      ...(typeof idClaims.picture === 'string' ? { picture: idClaims.picture } : {}),
    };
  }
}
