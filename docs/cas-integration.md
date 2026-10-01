# GT CAS authentication

Only the username (`cas:user`) is guaranteed. GT does not release email or
profile attributes by default, so we match provisioned users by `username` and
derive email as `username@gatech.edu`.

GT's [official Node.js starter](https://github.gatech.edu/webhosting/plesk-nodejs-sso-starter)
also identifies users by username alone. See [GT's attribute guidance](https://webdev.iac.gatech.edu/standards/developer-design-standards/#user-authorization-and-additional-attributes).
