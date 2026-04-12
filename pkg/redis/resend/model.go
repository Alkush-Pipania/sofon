package resend

import "github.com/resend/resend-go/v2"

type SendEmailRequest struct {
	From        string
	To          []string
	Cc          []string
	Bcc         []string
	Subject     string
	Html        string
	Text        string
	Attachments []*resend.Attachment
}
