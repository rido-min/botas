import * as nbgv from 'nerdbank-gitversioning';
import fs from 'fs';

const setPackageVersionAndBuildNumber = (versionInfo) => {
    // Set a build output value representing the NPM package version
    console.log("::set-output name=package_version::" + versionInfo.npmPackageVersion);
    
    fs.readdir('packages', { withFileTypes: true}, (err, files) => {
        if (err) {
            console.error("Failed to read the packages directory: " + err);
            return;
        }
        const folders = files
            .filter(file => file.isDirectory())
            .map(folder => `${folder.parentPath}/${folder.name}`);
        folders.forEach(f => nbgv.setPackageVersion(f));
    });
};

const handleError = (err) => console.error("Failed to update the package version number. nerdbank-gitversion failed: " + err);

nbgv.getVersion()
    .then(setPackageVersionAndBuildNumber)
    .catch(handleError);