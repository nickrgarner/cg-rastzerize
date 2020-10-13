/**
 * References: 
 * https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection
 * https://www.quirksmode.org/js/keys.html
 * http://glmatrix.net/docs/
 */

/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json";

/* Viewing parameters */
var eye = new vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
var lookAt = new vec3.fromValues(0,0,1); // Default lookAt vector
var upVector = new vec3.fromValues(0,1,0); // Default up vector
var lightPos = new vec3.fromValues(-0.5,1.5,-0.5); // Default light location
var lightColor = new vec3.fromValues(1,1,1); // Color of default light
var projectionMatrix = mat4.create(); // projection matrix in JS
var viewMatrix = mat4.create(); // view matrix in JS
var transformMatrix = mat4.create(); // transform matrix in JS

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!

var masterCoordArray = []; // coords to vertexBuffer
var vertexBuffer; // this contains vertex coordinates in triples
var masterNormArray = []; // normals to normalBuffer
var normalBuffer; // this contains normal vectors for each vertex
var masterIndexArray = []; // indices to triangleBuffer
var triangleBuffer; // this contains indices into vertexBuffer in triples
var masterShapeNumArray = []; // shape numbers for shapeNumBuffer
var shapeNumBuffer; // what number shape is this?
var masterAmbientArray = []; // ambient values to ambientBuffer
var ambientBuffer; // ambient rgb values for each vertex
var masterDiffuseArray = []; // diffuse values to diffuseBuffer
var diffuseBuffer; // diffuse rgb values for each vertex
var masterSpecularArray = []; // specular values to specularBuffer
var specularBuffer; // specular rgb values for each vertex
var masterSpecExpArray = []; // specular exponent values to specExpBuffer
var specExpBuffer; // specular exponent for each vertex
var triBufferSize = 0; // the number of indices in the triangle buffer
var shapeNum = 0; // which shape are we working with? Tris 0,1, Ellipsoids 2-4
var shapeCenters = []; // xyz coords of current center for each shape
var indexOffset = 0; // offset for index array

// Attributes
var vertexPositionAttrib; // where to put position for vertex shader
var vertexNormalAttrib; // where to put normals for vertex shader
var vertexAmbientAttrib; // ambient color component
var vertexDiffuseAttrib; // diffuse color component
var vertexSpecularAttrib; // specular color component
var vertexSpecExpAttrib; // specular exponent
var vertexShapeNumAttrib; // shape number

// Uniforms
var eyePosUniform; // position of eye in shaders
var projMatrixUniform; // projection matrix in shaders
var viewMatrixUniform; // view matrix in shaders
var xformMatrixUniform; // transform matrix in shaders
var lightPosUniform; // light position in shaders
var lightColorUniform; // light color in shaders
var currentShapeUniform; // shape currently highlighted

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input spheres

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

function loadTriangles() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");

    if (inputTriangles != String.null) {
        for (var set = 0; set < inputTriangles.length; set++) {

            // Get verticesfrom JSON
            for (var vertex = 0; vertex < inputTriangles[set].vertices.length; vertex++) {
                var vtxToAdd = inputTriangles[set].vertices[vertex];
                masterCoordArray.push(vtxToAdd[0], vtxToAdd[1], vtxToAdd[2]);
                masterNormArray.push(0,0,-1);
                masterAmbientArray.push(
                    inputTriangles[set].material.ambient[0],
                    inputTriangles[set].material.ambient[1],
                    inputTriangles[set].material.ambient[2]);
                masterDiffuseArray.push(
                    inputTriangles[set].material.diffuse[0],
                    inputTriangles[set].material.diffuse[1],
                    inputTriangles[set].material.diffuse[2]);
                masterSpecularArray.push(
                    inputTriangles[set].material.specular[0],
                    inputTriangles[set].material.specular[1],
                    inputTriangles[set].material.specular[2]);
                masterSpecExpArray.push(inputTriangles[set].material.n);
                masterShapeNumArray.push(shapeNum);
            }

            // Get triangle indices from JSON
            for (var face = 0; face < inputTriangles[set].triangles.length; face++) {
                masterIndexArray.push(
                    inputTriangles[set].triangles[face][0] + indexOffset,
                    inputTriangles[set].triangles[face][1] + indexOffset,
                    inputTriangles[set].triangles[face][2] + indexOffset);
                triBufferSize += 3;
            }

            // Add center coords, update shapeNum and indexOffset
            // if (set == 0) {
            //     var vtx1 = inputTriangles[set].vertices[0];
            //     var vtx2 = inputTriangles[set].vertices[1];
            //     var vtx3 = inputTriangles[set].vertices[2];
            //     var xCenter = (vtx1[0] + vtx2[0] + vtx3[0]) / 3;
            //     var yCenter = (vtx1[1] + vtx2[1] + vtx3[1]) / 3;
            //     var zCenter = (vtx1[2] + vtx2[2] + vtx3[2]) / 3;
            //     var center = {x: xCenter, y: yCenter, z: zCenter};
            // } else if (set == 1) {
            //     var vtx1 = inputTriangles[set].vertices[0];
            //     var vtx3 = inputTriangles[set].vertices[2];
            //     var xCenter = (vtx1[0] + vtx3[0]) / 2;
            //     var yCenter = (vtx1[1] + vtx3[1]) / 2;
            //     var zCenter = (vtx1[2] + vtx3[2]) / 2;
            //     var center = [xCenter, yCenter, zCenter];
            // }
            var center = [];
            if (set == 0) {
                center = [0.25, 0.7, 0.75];
            } else if (set == 1) {
                center = [0.25, 0.25, 0.75];
            }
            shapeCenters[shapeNum] = center;
            shapeNum++; // done with this shape
            indexOffset += inputTriangles[set].vertices.length;
        }
    }
}

function loadEllipsoidsParam() {
    var inputEllipsoids = getJSONFile(INPUT_ELLIPSOIDS_URL, "ellipsoids");

    if (inputEllipsoids != String.null) {
        for (var ellipsoid = 0; ellipsoid < inputEllipsoids.length; ellipsoid++) {
            var vertexCount = 0; // count of vertices for index array

            var ellCenter = {
                x: inputEllipsoids[ellipsoid].x,
                y: inputEllipsoids[ellipsoid].y,
                z: inputEllipsoids[ellipsoid].z
            };
            var numCircles = 32; // how many circles to make sphere out of

            // Get vertex coords and colors, push to arrays for buffers
            for (var latitude = 0; latitude < numCircles; latitude++) {
                var theta = (latitude / numCircles) * Math.PI;
                for (var longitude = 0; longitude < numCircles; longitude++) {
                    var phi = (longitude / numCircles) * 2 * Math.PI;

                    // Parameterize ellipsoid
                    var a = inputEllipsoids[ellipsoid].a;
                    var b = inputEllipsoids[ellipsoid].b;
                    var c = inputEllipsoids[ellipsoid].c;

                    var xUnit = Math.sin(theta) * Math.cos(phi);
                    var yUnit = Math.cos(theta);
                    var zUnit = Math.sin(theta) * Math.sin(phi);

                    masterCoordArray.push(
                        ellCenter.x + (a * xUnit),
                        ellCenter.y + (b * yUnit),
                        ellCenter.z + (c * zUnit)
                    );
                    masterNormArray.push(xUnit, yUnit, zUnit);
                    masterAmbientArray.push(
                        inputEllipsoids[ellipsoid].ambient[0],
                        inputEllipsoids[ellipsoid].ambient[1],
                        inputEllipsoids[ellipsoid].ambient[2]);
                    masterDiffuseArray.push(
                        inputEllipsoids[ellipsoid].diffuse[0],
                        inputEllipsoids[ellipsoid].diffuse[1],
                        inputEllipsoids[ellipsoid].diffuse[2]);
                    masterSpecularArray.push(
                        inputEllipsoids[ellipsoid].specular[0],
                        inputEllipsoids[ellipsoid].specular[1],
                        inputEllipsoids[ellipsoid].specular[2]);
                    masterSpecExpArray.push(inputEllipsoids[ellipsoid].n);
                    masterShapeNumArray.push(shapeNum);

                    // Get indices based on 2 tris between each longitude
                    var vtx1 = vertexCount;
                    var vtx2 = vertexCount + numCircles;

                    var tri1 = [vtx1, vtx2, vtx1 + 1];
                    var tri2 = [vtx2, vtx2 + 1, vtx1 + 1];

                    masterIndexArray.push(tri1[0] + indexOffset, tri1[1] + indexOffset, tri1[2] + indexOffset, tri2[0] + indexOffset, tri2[1] + indexOffset,tri2[2] + indexOffset);
                    triBufferSize += 6;

                    vertexCount++; // done with this vertex
                }
            }

            // Add center coords, update shapeNum and indexOffset
            var center = [
                inputEllipsoids[ellipsoid].x,
                inputEllipsoids[ellipsoid].y,
                inputEllipsoids[ellipsoid].z
            ];
            shapeCenters[shapeNum] = center;
            shapeNum++ // done with this shape
            indexOffset += vertexCount;
        }
    }

}

// Send coord, color, tri arrays to WebGL
function setupBuffers(coordArray, normArray, indexArray, ambientArray, diffuseArray, specularArray, specExpArray, shapeNumArray) {
    // send the vertex coords to webGL
    vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate that buffer
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coordArray),gl.STATIC_DRAW); // coords to that buffer

    // send the vertex normals to webGL
    normalBuffer = gl.createBuffer(); // init empty vertex normal buffer
    gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffer); // activate that buffer
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(normArray),gl.STATIC_DRAW); // coords to that buffer

    // send the triangle indices to webGL
    triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate buffer
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indexArray),gl.STATIC_DRAW); // indices to that buffer

    // send color values to webGL
    ambientBuffer = gl.createBuffer(); // init empty color buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, ambientBuffer); // activate buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ambientArray), gl.STATIC_DRAW); // colors to that buffer

    // send color values to webGL
    diffuseBuffer = gl.createBuffer(); // init empty color buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, diffuseBuffer); // activate buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(diffuseArray), gl.STATIC_DRAW); // colors to that buffer

    // send color values to webGL
    specularBuffer = gl.createBuffer(); // init empty color buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, specularBuffer); // activate buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(specularArray), gl.STATIC_DRAW); // colors to that buffer

    // send color values to webGL
    specExpBuffer = gl.createBuffer(); // init empty color buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, specExpBuffer); // activate buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(specExpArray), gl.STATIC_DRAW); // colors to that buffer

    // send shape numbers to webGL
    shapeNumBuffer = gl.createBuffer(); // init empty shapeNum buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, shapeNumBuffer); // activate buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shapeNumArray), gl.STATIC_DRAW); // numbers to that buffer
}

// setup the webGL shaders
function setupShaders() {

    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;
        attribute vec3 vertexNormal;
        attribute vec3 ambient;
        attribute vec3 diffuse;
        attribute vec3 specular;
        attribute float specularExponent;
        attribute float shapeNum;

        uniform vec3 eyePos;
        uniform vec3 lightPos;
        uniform vec3 lightColor;
        uniform mat4 projMatrix;
        uniform mat4 viewMatrix;
        uniform mat4 xformMatrix;
        uniform float currentShape;

        varying lowp vec4 vColor;

        void main(void) {
            vec3 N = normalize(vertexNormal); // normal vector
            vec3 L = normalize(lightPos - vertexPosition); // light vector
            vec3 V = normalize(eyePos - vertexPosition); // view vector
            vec3 H = normalize(L + V);
            
            vec3 color;
            for (int i = 0; i < 3; i++) {
                color[i] = ambient[i] * lightColor[0]; // ambient term
                color[i] += diffuse[i] * lightColor[1] * dot(N, L); // diffuse term
                color[i] += specular[i] * lightColor[2] * pow(dot(N, H), specularExponent);  // specular term

                // Clamp color
                if (color[i] > 1.0) {
                    color[i] = 1.0;
                } else if (color[i] < 0.0) {
                    color[i] = 0.0;
                }
            }

            if (shapeNum == currentShape) {
                gl_Position = projMatrix * viewMatrix * xformMatrix * vec4(vertexPosition, 1.0); // use transform matrix
            } else {
                gl_Position = projMatrix * viewMatrix * mat4(1.0) * vec4(vertexPosition, 1.0); // use untransformed position
            }

            vColor = vec4(color, 1.0);
        }
    `;
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        varying lowp vec4 vColor;

        void main(void) {
            gl_FragColor = vColor;
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)

                // Setup attributes
                vertexPositionAttrib = gl.getAttribLocation(shaderProgram, "vertexPosition"); // get pointer to vertex shader input
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array

                vertexNormalAttrib = gl.getAttribLocation(shaderProgram, "vertexNormal");
                gl.enableVertexAttribArray(vertexNormalAttrib);

                vertexAmbientAttrib = gl.getAttribLocation(shaderProgram, "ambient");
                gl.enableVertexAttribArray(vertexAmbientAttrib);

                vertexDiffuseAttrib = gl.getAttribLocation(shaderProgram, "diffuse");
                gl.enableVertexAttribArray(vertexDiffuseAttrib);

                vertexSpecularAttrib = gl.getAttribLocation(shaderProgram, "specular");
                gl.enableVertexAttribArray(vertexSpecularAttrib);

                vertexSpecExpAttrib = gl.getAttribLocation(shaderProgram, "specularExponent");
                gl.enableVertexAttribArray(vertexSpecExpAttrib);

                vertexShapeNumAttrib = gl.getAttribLocation(shaderProgram, "shapeNum");
                gl.enableVertexAttribArray(vertexShapeNumAttrib);

                // Setup uniforms
                eyePosUniform = gl.getUniformLocation(shaderProgram, 'eyePos');
                gl.uniform3fv(eyePosUniform, eye);

                mat4.perspective(projectionMatrix, glMatrix.toRadian(90), 1, 0.1, 100);
                projMatrixUniform = gl.getUniformLocation(shaderProgram, 'projMatrix');
                gl.uniformMatrix4fv(projMatrixUniform, gl.FALSE, projectionMatrix);
                
                var center = vec3.create();
                vec3.add(center, eye, lookAt);
                mat4.lookAt(viewMatrix, eye, center, upVector);
                viewMatrixUniform = gl.getUniformLocation(shaderProgram, 'viewMatrix');
                gl.uniformMatrix4fv(viewMatrixUniform, gl.FALSE, viewMatrix);

                mat4.identity(transformMatrix);
                xformMatrixUniform = gl.getUniformLocation(shaderProgram, 'xformMatrix');
                gl.uniformMatrix4fv(xformMatrixUniform, gl.FALSE, transformMatrix);

                lightPosUniform = gl.getUniformLocation(shaderProgram, 'lightPos');
                gl.uniform3fv(lightPosUniform, lightPos);

                lightColorUniform = gl.getUniformLocation(shaderProgram, 'lightColor');
                gl.uniform3fv(lightColorUniform, lightColor);

                currentShapeUniform = gl.getUniformLocation(shaderProgram, 'currentShape');
                gl.uniform1f(currentShapeUniform, shapeNum);
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

var bgColor = 0;
// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    // bgColor = (bgColor < 1) ? (bgColor + 0.001) : 0;
    // gl.clearColor(bgColor, 0, 0, 1.0);
    // requestAnimationFrame(renderTriangles);

    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed
    // gl.uniform1i(altPositionUniform, altPosition); // feed

    // normal buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffer); // activate
    gl.vertexAttribPointer(vertexNormalAttrib,3,gl.FLOAT,false,0,0); // feed

    // color buffers: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER, ambientBuffer); // activate
    gl.vertexAttribPointer(vertexAmbientAttrib,3,gl.FLOAT,false,0,0); // feed
    gl.bindBuffer(gl.ARRAY_BUFFER, diffuseBuffer); // activate
    gl.vertexAttribPointer(vertexDiffuseAttrib,3,gl.FLOAT,false,0,0); // feed
    gl.bindBuffer(gl.ARRAY_BUFFER, specularBuffer); // activate
    gl.vertexAttribPointer(vertexSpecularAttrib,3,gl.FLOAT,false,0,0); // feed
    gl.bindBuffer(gl.ARRAY_BUFFER, specExpBuffer); // activate
    gl.vertexAttribPointer(vertexSpecExpAttrib,1,gl.FLOAT,false,0,0); // feed

    // shapeNum buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER, shapeNumBuffer); // activate
    gl.vertexAttribPointer(vertexShapeNumAttrib,1,gl.FLOAT,false,0,0); // feed

    // // triangle buffer: activate and render
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffer); // activate
    gl.drawElements(gl.TRIANGLES,triBufferSize,gl.UNSIGNED_SHORT,0); // render

    // gl.drawArrays(gl.TRIANGLES,0,triBufferSize); // render
} // end render triangles

// Process key presses for shape selection
function selectShape(e) {
    requestAnimationFrame(selectShape);
    var deselect = false;

    switch (e.keyCode) {
        case 37: // left - highlight previous triangle set
        case 39: // right - highlight next triangle set
            if (shapeNum <= 0) {
                shapeNum = 1;
            } else if (shapeNum >= 1) {
                shapeNum = 0;
            }
            break;
        case 38: // up - highlight next ellipsoid
            if (shapeNum < 2 || shapeNum >= 4) {
                shapeNum = 2;
            } else {
                shapeNum++;
            }
            break;
        case 40: // down - highlight previous ellipsoid
            if (shapeNum <= 2) {
                shapeNum = 4;
            } else {
                shapeNum--;
            }
            break;
        case 32: // space - deselect and turn off highlight
            deselect = true;
            break;
    }
    // Update currentShape and transform matrix for highlighting
    if (deselect) {
        shapeNum = -1;
    } else {
        mat4.fromTranslation(transformMatrix, shapeCenters[shapeNum]);
        mat4.scale(transformMatrix, transformMatrix, [1.2, 1.2, 1.2]);
        mat4.translate(transformMatrix, transformMatrix, [-shapeCenters[shapeNum][0], -shapeCenters[shapeNum][1], -shapeCenters[shapeNum][2]]);
    }

    // Send transform matrix and render
    gl.uniformMatrix4fv(xformMatrixUniform, gl.FALSE, transformMatrix);
    gl.uniform1f(currentShapeUniform, shapeNum);
    renderTriangles();
}

// Process key presses for all view and model transforms
function processKeys(e) {
    
}

/* MAIN -- HERE is where execution begins after window load */

function main() {
  
    setupWebGL(); // set up the webGL environment
    loadTriangles(); // load in the triangles from tri file
    loadEllipsoidsParam(); // load the ellipsoids from json
    shapeNum = -1.0; // reset shapeNum
    setupBuffers(masterCoordArray, masterNormArray, masterIndexArray, masterAmbientArray, masterDiffuseArray, masterSpecularArray, masterSpecExpArray, masterShapeNumArray);
    setupShaders(); // setup the webGL shaders
    document.onkeydown = selectShape; // arrow keys for shape selection
    document.onkeypress = processKeys; // keys for transforms
    renderTriangles(); // draw the triangles using webGL

} // end main
