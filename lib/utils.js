const fs = require('fs');
const path = require('path');

var xml_special_to_encoded_attribute = {
    '&': '&amp;',
    '<': '&lt;',
    '"': '&quot;',
    '\r': '&#xD;',
    '\n': '&#xA;',
    '\t': '&#x9;'
}

var xml_special_to_encoded_text = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '\r': '&#xD;'
}

function encodeSpecialCharactersInAttribute(attributeValue){
    return attributeValue
        .replace(/[\r\n\t ]+/g, ' ') // White space normalization (Note: this should normally be done by the xml parser) See: https://www.w3.org/TR/xml/#AVNormalize
        .replace(/([&<"\r\n\t])/g, function(str, item){
            // Special character normalization. See:
            // - https://www.w3.org/TR/xml-c14n#ProcessingModel (Attribute Nodes)
            // - https://www.w3.org/TR/xml-c14n#Example-Chars
            return xml_special_to_encoded_attribute[item]
        });
}

function encodeSpecialCharactersInText(text){
    return text
        .replace(/\r\n?/g, '\n')  // Line ending normalization (Note: this should normally be done by the xml parser). See: https://www.w3.org/TR/xml/#sec-line-ends
        .replace(/([&<>\r])/g, function(str, item){
            // Special character normalization. See:
            // - https://www.w3.org/TR/xml-c14n#ProcessingModel (Text Nodes)
            // - https://www.w3.org/TR/xml-c14n#Example-Chars
            return xml_special_to_encoded_text[item]
        });
}

function makeFilePath(pathName) {
    if (fs.existsSync(pathName)) {
        return true;
    }
    else {
        if (makeFilePath(path.dirname(pathName))) {
            fs.mkdirSync(pathName);
            return true;
        }
    }
}
/*
downloadFile(srcPath, dstPath) {
    console.info('[webide-common-tizentv]utils: downloadFile start...');
    if (!fs.existsSync(dstPath)) {
        makeFilePath(dstPath);
    }

    let streamFile = fs.createWriteStream(dstPath);
    console.info('[webide-common-tizentv]constructor():requet to download ' + srcPath);
    request(srcPath).pipe(streamFile).on('close', () => {
        console.info('[webide-common-tizentv]downloadFile(): download file successful');
    });
}

uncompressFile(compressFile, uncompressPath) {
    console.info('[webide-common-tizentv]uncompressFile():uncompressFile start...');
    compressing.zip.uncompress(compressFile, uncompressPath).then(() => {
        console.info('[webide-common-tizentv]uncompressFile():unzip ' + this.certZipFile + ' to ' + uncompressPath + ' successful');
    }).catch((err) => {
        console.error('[webide-common-tizentv]uncompressFile():' + err);
    });
}
*/
exports.encodeSpecialCharactersInAttribute = encodeSpecialCharactersInAttribute;
exports.encodeSpecialCharactersInText = encodeSpecialCharactersInText;
exports.makeFilePath = makeFilePath;
