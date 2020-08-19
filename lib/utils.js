const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..');
const toolsDir = path.resolve(extensionRoot, 'tools');
const tmpDir = path.resolve(extensionRoot, 'tmp');
const tizenDownloadUrl = 'http://download.tizen.org/sdk/tizenstudio/official';

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

module.exports = {
    extensionRoot,
    toolsDir,
    tmpDir,
    tizenDownloadUrl,
    encodeSpecialCharactersInAttribute,
    encodeSpecialCharactersInText,
    makeFilePath
}
