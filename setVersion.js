const nbgv = require("nerdbank-gitversioning");

const setPackageVersionAndBuildNumber = (versionInfo) => {
    // Set a build output value representing the NPM package version
    console.log("::set-output name=package_version::" + versionInfo.npmPackageVersion);
    
    nbgv.setPackageVersion("packages/core");
    nbgv.setPackageVersion("packages/hosting");
};

const handleError = (err) => console.error("Failed to update the package version number. nerdbank-gitversion failed: " + err);

nbgv.getVersion()
    .then(setPackageVersionAndBuildNumber)
    .catch(handleError);