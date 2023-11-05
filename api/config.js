import {createRemoteJWKSet, jwtVerify} from "jose";
import request from "needle";

const {AUTH_SERVER_URL, AUTH_REALM, GATEWAY_ACCOUNT_URL, GATEWAY_KEY} = process.env;
// Credit: https://github.com/keycloak/keycloak-nodejs-connect/issues/492#issuecomment-1603213677
const jwks = createRemoteJWKSet(new URL(
	`${AUTH_SERVER_URL}/realms/${AUTH_REALM}/protocol/openid-connect/certs`));
const GATEWAY = new class {
	accountUrl = new URL(GATEWAY_ACCOUNT_URL);
	accountName = this.accountUrl.pathname.slice(1);
};

// noinspection JSUnusedGlobalSymbols
/**
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default async function (req, res) {
	const sendErr = (code, text, error) => {
		console.warn(error);
		res.status(code).json({text, error});
	};
	const throwErr = (code, text) => error => {
		throw {send: () => sendErr(code, text, error)};
	};
	try {
		const subdomain = req.query.domain;
		const [type, token] = req.headers.authorization?.split(" ") ?? [];
		if (type !== "Bearer")
			return sendErr(401, 'Unauthorised');
		const {payload} = await jwtVerify(token, jwks)
			.catch(throwErr(401, 'Unauthorised'));
		await checkAccess(payload.sub, subdomain)
			.catch(throwErr(403, 'Forbidden'));
		const configRes = await request('put', new URL(
			`/api/v1/domain/${GATEWAY.accountName}/${subdomain}`, GATEWAY.accountUrl
		).toString(), {
			user: {'@id': `${AUTH_SERVER_URL}/users/${payload.sub}`}
		}, {
			json: true,
			auth: 'basic',
			username: GATEWAY.accountName,
			password: GATEWAY_KEY
		});
		if (configRes.statusCode !== 200)
			return sendErr(configRes.statusCode, configRes.statusMessage, configRes.body);
		res.status(200).json(configRes.body);
	} catch (error) {
		error.send ? error.send() : sendErr(500, 'Internal Server Error', error);
	}
}

/**
 * Check whether the given user has access to the given todolist (domain)
 * @param {string} user the authenticated user according to the identity provider
 * @param {string} subdomain the todolist identity
 */
async function checkAccess(user, subdomain) {
	// TODO: Check fine-grained access to todolists, via sharing
}
