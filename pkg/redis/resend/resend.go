package resend

import (
	"context"

	rs "github.com/resend/resend-go/v2"
)

type Client interface {
	SendEmail(ctx context.Context, req *SendEmailRequest) (string, error)
}

type resendClientImpl struct {
	api *rs.Client
}

func NewResendClient(apiKey string) Client {
	return &resendClientImpl{
		api: rs.NewClient(apiKey),
	}
}

func (c *resendClientImpl) SendEmail(ctx context.Context, req *SendEmailRequest) (string, error) {
	params := &rs.SendEmailRequest{
		From:        req.From,
		To:          req.To,
		Cc:          req.Cc,
		Bcc:         req.Bcc,
		Subject:     req.Subject,
		Html:        req.Html,
		Text:        req.Text,
		Attachments: req.Attachments,
	}

	resp, err := c.api.Emails.SendWithContext(ctx, params)
	if err != nil {
		return "", err
	}

	return resp.Id, nil
}
