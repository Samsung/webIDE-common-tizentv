# @tizentv/webIDE-common-tizentv
`@tizentv/webIDE-common-tizentv` package is a common lib project for VScode/Atom extension and Wits, providing build, install, launch web project and certificate manager.

Please note that, In order to use this pacakge, `@tizentv/webIDE-common-tizentv` is required.

## Supported APIs
-   TVWebApp

```js
    constructor(name, location, id);
    init();
    buildWidget(profilePath, excludeFiles);
    launchOnSimulator(simulatorLocation);
    launchOnEmulator(chromeExecPath, isDebug);
    launchOnTV(tvIP, chromeExecPath, isDebug);
    openProject(projectPath);
```

-   TizenCM

```js
    constructor(resourcePath) ;

    /*
    authorInfo {
        authorFile: '',
        authorName: '',
        authorPassword: '',
        authorCountry: '',
        authorState: '',
        authorCity: '',
        authorOrganization: '',
        authorDepartment: '',
        authorEmail: ''
    }
    */
    createCert(authorInfo);
```

-   SamsungCM

```js
    constructor(resourcePath);

    /*
        authorInfo  {
            authorName : '',
            authorPassword : '',
            authorCountry : '',
            authorState : '',
            authorCity : '',
            authorOrganization : '',
            authorDepartment : ''
    */
    ceateAuthorCert(profileName, authorInfo, accessInfo);

    /*
        distrbutorInfo {
            distributorPassword : '',
            privilegeLevel : '',
            duidList : ['', '', ...]
    */
    ceateDistributorCert(profileName, distrbutorInfo, accessInfo);
```

-   ProfileManager

```js
    constructor(resourcePath);

    /*
        authorProfile{
            authorCA: '',
            authorCertPath: '',
            authorPassword: ''
        }
        distributorProfile{
            distributorCA: '',
            distributorCertPath: '',
            distributorPassword: ''
        }
    */
    registerProfile(profileName, authorProfile, distributorProfile);
    setActivateProfile(profileName);
    removeProfile(profileName);
    modifyProfile(profileName, itemType, certpath, password);
    isProfileExist(profileName);
    listProfile();
    getProfileKeys(profileName);
    getProfileItems(profileName);
```
