import * as nbgv from 'nerdbank-gitversioning'
import fs from 'fs'
import path from 'path'


const updateDeps = (p, v) => {
  if (!fs.existsSync('package-lock.json')) {
    console.error('package-lock.json not found')
    return
  }
  const pkgLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'))
  const packageJsonPath = path.join(p, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath , 'utf8'))
  const deps = packageJson.dependencies
  for (const dep in deps) {
    const lockNode = pkgLock.packages[`node_modules/${dep}`]
    if (lockNode && lockNode.link) {
      deps[dep] = v
    } else {
      console.log(dep + ' Not a link')
    }
  }
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
}

const setPackageVersionAndBuildNumber = versionInfo => {
  // Set a build output value representing the NPM package version
  console.log('::set-output name=package_version::' + versionInfo.npmPackageVersion)
  console.log('##vso[build.updatebuildnumber]' + versionInfo.npmPackageVersion)

  fs.readdir('packages', { withFileTypes: true }, (err, files) => {
    if (err) {
      console.error('Failed to read the packages directory: ' + err)
      return
    }
    const folders = files
      .filter(file => file.isDirectory())
      .map(folder => `${folder.parentPath}/${folder.name}`)
    folders.forEach(f => {
      updateDeps(f, versionInfo.npmPackageVersion)
      nbgv.setPackageVersion(f)
    })
  })
}

const handleError = (err) => console.error('Failed to update the package version number. nerdbank-gitversion failed: ' + err)

nbgv.getVersion()
  .then(setPackageVersionAndBuildNumber)
  .catch(handleError)
