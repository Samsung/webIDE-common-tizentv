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

-   TizenCertManager

```js
    constructor(resourcePath) ;
    async init();
    /*
    authorInfo {
        keyFileName: '',
        authorName: '',
        authorPassword: '',
        countryInfo: '',
        stateInfo: '',
        cityInfo: '',
        organizationInfo: '',
        departmentInfo: '',
        emailInfo: ''
    }
    */
    createCert(authorInfo);
    getTizenDeveloperCA();
    /*
    * privilegeLevel: 'public'/'partner'
    */
    getTizenDistributorProfile(privilegeLevel);

    usage:
        /*
         * TizenCertManager downloads certificate file from tizen.org, if using proxy to connect internet, please configure 'http-proxy' and 'https-proxy' in npm config list.
         * eg. npm config set http-proxy http://192.168.0.1:8080
         *     npm config set https-proxy http://192.168.0.1:8080
         */
        let tizenCertMgr = new TizenCertManager('D:\resource');
        await tizenCertMgr.init();
        tizenCertMgr.createCert(authorInfo);
```

-   SamsungCertManager

```js
    constructor(resourcePath);
    async init();
    /*
    authorInfo  {
        name : '',
        password : '',
        country : '',
        state : '',
        city : '',
        organization : '',
        department : ''
    */
    createAuthorCert(profileName, authorInfo, accessInfo);

    /*
        distrbutorInfo {
            distributorPassword : '',
            privilegeLevel : '',
            duidList : ['', '', ...]
    */
    createDistributorCert(profileName, distrbutorInfo, accessInfo);

    usage:
        /*
         * SamsungCertManager downloads certificate file from tizen.org, if using proxy to connect internet, please configure 'http-proxy' and 'https-proxy' in npm config list.
         * eg. npm config set http-proxy http://192.168.0.1:8080
         *     npm config set https-proxy http://192.168.0.1:8080
         */
        let samsungCertMgr = new SamsungCertManager('D:\resource');
        await samsungCertMgr.init();
        samsungCertMgr.createAuthorCert(authorInfo);
        samsungCertMgr.createDistributorCert(profileName, distrbutorInfo, accessInfo);
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

    usage:
        let profileMgr = new ProfileManager(common.resourcePath);
        tizenAuthorProfile = {
            authorCA: tizenCertMgr.getTizenDeveloperCA(),
            authorCertPath: authorCertPath,
            authorPassword: authorPassword
        };
        tizenDistributorProfile = tizenCertMgr.getTizenDistributorProfile('public');
        profileMgr.registerProfile('name', tizenAuthorProfile, tizenDistributorProfile);
```
