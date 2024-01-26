# Transmit: How to push to NPM

Our organization URL: https://www.npmjs.com/org/transmitlive

Our NPM credentials can be found in 1Password, 'npmjs' item in the Engineering vault..

1. Log in to NPM from the CLI (`npm login`) and follow the prompts.

> You can find the credentials in 1Password, 'npmjs' item in the Engineering vault.

2. Update the package version in `package.json` and commit the change

3. Run `npm publish --access=public` from the root of the project

You should see your new package at https://www.npmjs.com/settings/transmitlive/packages
