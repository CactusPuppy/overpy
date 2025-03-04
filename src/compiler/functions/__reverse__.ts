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

import { astParsingFunctions, enableOptimization } from "../../globalVars";
import { Ast, getAstForMinus1, getAstForCurrentArrayIndex } from "../../utils/ast";

astParsingFunctions.__reverse__ = function (content) {
    if (enableOptimization) {
        if (content.args[0].name === "__array__") {
            content.args[0].args.reverse();
            return content.args[0];
        }
    }

    return new Ast("__sortedArray__", [content.args[0], new Ast("__multiply__", [getAstForMinus1(), getAstForCurrentArrayIndex()])]);
};
