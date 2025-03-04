/*
 * This file is part of OverPy (https://github.com/Zezombye/overpy).
 * Copyright (c) 2019 Zezombye.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

import { parse } from "../compiler/parser";
import { typeMatrix } from "../globalVars";
import { Type } from "../types";
import { Token } from "../compiler/tokenizer";
import { Ast, getAstForNumber } from "./ast";
import { error, warn } from "./logging";
import { splitTokens } from "./tokens";

/**
 *
 * @returns {boolean} Whether the `receivedType` is suitable to be used in places where `expectedType` is desired.
 *
 * @remarks
A type is suitable if each type of the receivedType is suitable for any of the types in expectedType.
Eg: ["unsigned float", "Vector"] is suitable for ["float", "Direction"].
However ["float", "Vector"] is not suitable for ["float"].

A type is defined as "suitable" if it is the type, or a child type, of expectedType.
Eg: "float" is suitable for "Object". However "Object" is not suitable for "float".
Moreover, {Array: "Player"} is not suitable for "Array".

The special "Value" type is suitable for any child type of object or array.
*/
export function isTypeSuitable(expectedType: Type | Type[], receivedType: Type | Type[], valueTypeIsSuitable = true): boolean {
    let receivedTypeName = typeof receivedType === "string" ? receivedType : Object.keys(receivedType)[0];

    if (receivedType instanceof Array) {
        //Check if each of the received type is valid for the expected type.
        return receivedType.every((x) => isTypeSuitable(expectedType, x, valueTypeIsSuitable));
    }

    if (expectedType instanceof Array) {
        //Check if the received type is valid for any of the expected types.
        return expectedType.some((x) => isTypeSuitable(x, receivedType, valueTypeIsSuitable));
    }

    if (typeof receivedType === "string") {
        if (typeof expectedType === "string") {
            //Do not check for type "Variable". Functions with such a type are checked manually.
            if (expectedType === "Variable") {
                return true;
            }
            //Handle the special "value" type.
            if (receivedType === "Value" && valueTypeIsSuitable) {
                return expectedType === "Value" || expectedType === "Array" || typeMatrix["Object"].includes(expectedType);
            } else if (expectedType === "Value" && valueTypeIsSuitable) {
                return receivedType === "Array" || typeMatrix["Object"].includes(receivedType);
            } else {
                //The most simple case: both types are string. Simply use the type matrix to see if the received type is a child (or the type itself) of the expected type.
                if (!(expectedType in typeMatrix)) {
                    error("Unhandled type '" + expectedType + "'");
                }
                return typeMatrix[expectedType].includes(receivedType);
            }
        } else if (typeof expectedType === "object") {
            var expectedTypeName = Object.keys(expectedType)[0];
            if (expectedTypeName === "Array") {
                //The only string type that would be suitable for Array is the special "value" type.
                return receivedType === "Value";
            } else if (["Vector", "Direction", "Position", "Velocity"].includes(expectedTypeName)) {
                return isTypeSuitable(expectedTypeName, receivedType);
            }
        }
    } else if (typeof receivedType === "object") {
        if (receivedTypeName === "Array") {
            if (typeof expectedType === "string") {
                //The only string type that is suitable for an array is "Array".
                return expectedType === "Array";
            } else if (typeof expectedType === "object") {
                var expectedTypeName = Object.keys(expectedType)[0];
                if (expectedTypeName === "Array") {
                    return isTypeSuitable(expectedType[expectedTypeName], receivedType[receivedTypeName]);
                } else if (["Vector", "Direction", "Position", "Velocity"].includes(expectedTypeName)) {
                    //An array cannot be suitable for a vector
                    return false;
                }
            }
        } else if (["Vector", "Direction", "Position", "Velocity"].includes(receivedTypeName)) {
            if (typeof expectedType === "string" && typeof receivedType[receivedTypeName] !== "string") {
                //The default type for vectors is float.
                return isTypeSuitable(expectedType, receivedTypeName) && (receivedType[receivedTypeName] as Type[]).every((x) => isTypeSuitable("float", x));
            } else if (typeof expectedType === "object") {
                var expectedTypeName = Object.keys(expectedType)[0];
                if (expectedTypeName === "Array") {
                    //An vector cannot be suitable for a array
                    return false;
                } else if (["Vector", "Direction", "Position", "Velocity"].includes(expectedTypeName)) {
                    if (isTypeSuitable(expectedTypeName, receivedTypeName)) {
                        if (expectedType[expectedTypeName].length !== receivedType[receivedTypeName].length) {
                            return false;
                        } else {
                            for (var i = 0; i < expectedType[expectedTypeName].length; i++) {
                                if (!isTypeSuitable(expectedType[expectedTypeName][i], receivedType[receivedTypeName][i])) {
                                    return false;
                                }
                            }
                            return true;
                        }
                    } else {
                        return false;
                    }
                }
            }
        }
    }

    error("Unhandled expected type '" + JSON.stringify(expectedType) + "' or received type '" + JSON.stringify(receivedTypeName) + "'");
}

export function parseType(tokens: Token[]): Ast {
    if (tokens.length === 0) {
        error("Content is empty (expected a type)");
    }
    if (!Object.keys(typeMatrix).includes(tokens[0].text)) {
        // This used to be an error, but considering the above condition was previously
        // bugged to never fire, and doing the correct checking actually results in
        // Workshop setting enums
        warn("w_type_check", "Expected a type, but got '" + tokens[0].text + "'");
    }
    if (tokens.length === 1) {
        return new Ast(tokens[0].text, [], [], "Type");
    }

    if (tokens.length >= 3 && tokens[tokens.length - 2].text === "[" && tokens[tokens.length - 1].text === "]") {
        return new Ast("Array", [parseType(tokens.slice(0, tokens.length - 2))], [], "Type");
    }

    if (tokens[0].text === "unsigned" || tokens[0].text === "signed") {
        if (tokens[1].text !== "int" && tokens[1].text !== "float") {
            error("Expected 'int' or 'float' after '" + tokens[0].text + "', but got '" + tokens[1].text + "'");
        }
        if (tokens.length !== 2) {
            error("Expected end of type after '" + tokens[0].text + " " + tokens[1].text + "', but got '" + tokens[2].text + "'");
        }
        return new Ast(tokens[0].text + " " + tokens[1].text, [], [], "Type");
    }

    if (tokens[1].text !== "<" && tokens[1].text !== "[") {
        error("Expected '[' after '" + tokens[0].text + "', but got '" + tokens[1].text + "'");
    }
    if (tokens[tokens.length - 1].text !== ">" && tokens[tokens.length - 1].text !== "]") {
        error("Expected ']' at end of type, but got '" + tokens[tokens.length - 1].text + "'");
    }

    if (tokens[0].text !== "int" && tokens[0].text !== "float" && tokens[0].text !== "enum") {
        error("Expected 'int', 'float' or 'enum' before '[', but got '" + tokens[0].text + "'");
    }

    var typeParams = tokens.slice(2, tokens.length - 1);

    if (tokens[0].text === "int" || tokens[0].text === "float") {
        //There should be a ":" delimiter.
        var tokenMinAndMax = splitTokens(typeParams, ":", true);
        if (tokenMinAndMax.length !== 2) {
            error("Expected one ':' in parameters for '" + tokens[0].text + "'");
        }
        var tokenMin = tokenMinAndMax[0];
        var tokenMax = tokenMinAndMax[1];
        if (tokenMin.length === 0) {
            var min = -9999999999999;
        } else {
            if (tokens[0].text === "int") {
                var min = parseInt(tokenMin.map((x) => x.text).join(""));
            } else {
                var min = parseFloat(tokenMin.map((x) => x.text).join(""));
            }
        }
        if (tokenMax.length === 0) {
            var max = 9999999999999;
        } else {
            if (tokens[0].text === "int") {
                var max = parseInt(tokenMax.map((x) => x.text).join(""));
            } else {
                var max = parseFloat(tokenMax.map((x) => x.text).join(""));
            }
        }

        if (min > max) {
            error("Minimum for type '" + tokens[0].text + "' (" + min + ") is higher than maximum (" + max + ")");
        }

        return new Ast(tokens[0].text, [getAstForNumber(min), getAstForNumber(max)], [], "Type");
    } else if (tokens[0].text === "enum") {
        var enumMembers = splitTokens(typeParams, ",", true);

        if (enumMembers[enumMembers.length - 1].length === 0) {
            enumMembers.pop();
        }
        if (enumMembers.length === 0) {
            error("Cannot declare an enum without specifying values");
        }
        return new Ast(
            "__enumType__",
            enumMembers.map((x) => parse(x)),
            [],
            "Type",
        );
    }

    error(`Failed to parse tokens ${JSON.stringify(tokens)} as type`);
}
