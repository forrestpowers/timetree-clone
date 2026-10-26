import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => (value ? value : undefined);

export const variables = defineEnvVars({
	DATA_DIR: {
		description: 'Directory for the SQLite database and uploaded files.',
		schema: (value) => value || './data'
	},
	APP_ORIGIN: {
		description:
			'Public URL of the app, e.g. https://cal.example.com. Used for email links, passkeys and calendar feeds.',
		schema: (value) => (value || 'http://localhost:5173').replace(/\/+$/, '')
	},
	APP_NAME: {
		description: 'Name shown in the UI, emails and the installed app.',
		public: true,
		schema: (value) => value || 'Calendar'
	},
	SIGNUP_MODE: {
		description:
			'"invite" (default): only the first user, or someone holding a valid invite link, can sign up. "open": anyone can.',
		schema: (value) => (value === 'open' ? 'open' : 'invite')
	},
	SMTP_URL: {
		description:
			'SMTP connection string, e.g. smtps://user:pass@smtp.example.com:465. When unset, emails are printed to the server log.',
		schema: optional
	},
	MAIL_FROM: {
		description: 'Sender address for emails.',
		schema: optional
	}
});
