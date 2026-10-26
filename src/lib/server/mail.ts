import nodemailer from 'nodemailer';
import { APP_NAME } from '$app/env/public';
import { MAIL_FROM, SMTP_URL } from '$app/env/private';

const transport = SMTP_URL ? nodemailer.createTransport(SMTP_URL) : null;

export async function sendMail(to: string, subject: string, text: string) {
	if (!transport) {
		console.log(`\n[mail] SMTP_URL not set; would send to ${to}\nSubject: ${subject}\n\n${text}\n`);
		return;
	}
	await transport.sendMail({
		from: MAIL_FROM ?? `${APP_NAME} <no-reply@localhost>`,
		to,
		subject,
		text
	});
}
