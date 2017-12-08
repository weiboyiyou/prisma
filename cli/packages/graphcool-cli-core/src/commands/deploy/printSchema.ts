import { Client } from 'graphcool-cli-engine'
import {
  buildClientSchema,
  printSchema,
  parse,
  DefinitionNode,
  print,
  Kind,
} from 'graphql'
import { groupBy } from 'lodash'

type GraphcoolDefinitionType = 'model' | 'rest'

const typesOrder: GraphcoolDefinitionType[] = ['model', 'rest']
const descriptions: { [key: string]: string } = {
  model: `Model Types`,
  rest: `Other Types`,
}

export async function fetchAndPrintSchema(
  client: Client,
  serviceName: string,
  stageName: string,
): Promise<string> {
  const introspection = await client.introspect(serviceName, stageName)
  const schema = buildClientSchema(introspection)

  const sdl = printSchema(schema)
  const document = parse(sdl)
  const groupedDefinitions = groupBy(document.definitions, classifyDefinition)
  let sortedDefinitions: DefinitionNode[] = []

  typesOrder.map(type => {
    const definitions = groupedDefinitions[type]
    sortedDefinitions = sortedDefinitions.concat(definitions)
  })

  let newSdl = print({
    kind: Kind.DOCUMENT,
    definitions: sortedDefinitions,
  })

  const newDocument = parse(newSdl)

  // add comments to document
  let countOffset = 0
  let charOffset = 0
  typesOrder.forEach((type, index) => {
    const definitionCount = groupedDefinitions[type].length
    const definitions = newDocument.definitions.slice(
      countOffset,
      definitionCount,
    )
    const start = definitions[0].loc!.start

    const comment = `\
${index > 0 ? '\n' : ''}#
# ${descriptions[type]}
#\n\n`

    newSdl =
      newSdl.slice(0, start + charOffset) +
      comment +
      newSdl.slice(start + charOffset)

    charOffset += comment.length
    countOffset += definitionCount
  })

  return newSdl
}

function classifyDefinition(def: DefinitionNode): GraphcoolDefinitionType {
  if (
    def.kind === 'ObjectTypeDefinition' &&
    def.interfaces &&
    def.interfaces.length > 0 &&
    def.interfaces[0].name.value === 'Node'
  ) {
    return 'model'
  }

  return 'rest'
}
