package security

import (
	"time"

	"github.com/alkush-pipania/sofon/config"
	"github.com/golang-jwt/jwt/v5"
)

type TokenService struct {
	secret   string
	tokenTTL time.Duration
}

func NewTokenService(authCfg *config.AuthConfig) *TokenService {
	return &TokenService{
		secret:   authCfg.Secret,
		tokenTTL: authCfg.TokenTTL,
	}
}

func (ts *TokenService) GenerateAccessToken(payload RequestClaims) (string, error) {
	now := time.Now()
	expiryTime := now.Add(ts.tokenTTL)

	payload.ExpiresAt = jwt.NewNumericDate(expiryTime)
	payload.IssuedAt = jwt.NewNumericDate(now)

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, payload)
	signedToken, err := token.SignedString([]byte(ts.secret))
	if err != nil {
		return "", err
	}

	return signedToken, nil
}

func (ts *TokenService) ValidateAccessToken(accessToken string) (*RequestClaims, error) {
	const op string = "service.token.validate_access_token"

	claims := &RequestClaims{}

	token, err := jwt.ParseWithClaims(
		accessToken,
		claims,
		func(t *jwt.Token) (any, error) {
			if t.Method != jwt.SigningMethodHS256 {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(ts.secret), nil
		},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Name}),
	)

	if err != nil || !token.Valid {
		return nil, err // TODO : update the error here
	}

	return claims, nil
}
